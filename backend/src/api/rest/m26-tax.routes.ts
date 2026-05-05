/**
 * M26: Tax Intelligence Routes
 * API endpoints for tax projections, forecast, rate sheets and coverage
 */

import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { taxProjectionService } from '../../services/tax/taxProjection.service';
import { taxService } from '../../services/tax/taxService';
import { buildTaxContext, TaxContextOverrides, DealRowForTaxContext } from '../../services/tax/compositeResolver';
import { getAllRateSheets, getRateSheet } from '../../services/tax/rateSheets/loader';
import { query } from '../../database/connection';

const router = Router();

// ─── Legacy projection routes ─────────────────────────────────────────────────

/**
 * POST /api/v1/deals/:dealId/tax/projection
 * Calculate tax projection for a deal
 */
router.post('/deals/:dealId/tax/projection', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const {
      purchase_price,
      parcel_id,
      county_id,
      units,
      override_millage,
      override_non_ad_valorem,
      exemption_reduction_pct,
      projection_years,
      market_value_growth_rate,
      millage_trend_assumption
    } = req.body;

    if (!purchase_price || !units) {
      return res.status(400).json({
        success: false,
        error: 'purchase_price and units are required'
      });
    }

    const projection = await taxProjectionService.calculateProjection({
      deal_id: dealId,
      purchase_price,
      parcel_id,
      county_id,
      units,
      override_millage,
      override_non_ad_valorem,
      exemption_reduction_pct,
      projection_years,
      market_value_growth_rate,
      millage_trend_assumption
    });

    res.json({
      success: true,
      data: projection
    });
  } catch (error: any) {
    console.error('Tax projection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/tax/projection
 * Get existing tax projection for a deal
 */
router.get('/deals/:dealId/tax/projection', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;

    const projection = await taxProjectionService.getProjectionByDeal(dealId);

    if (!projection) {
      return res.status(404).json({
        success: false,
        error: 'No tax projection found for this deal'
      });
    }

    res.json({
      success: true,
      data: projection
    });
  } catch (error: any) {
    console.error('Get tax projection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/tax/summary
 * Get tax summary for dashboard/capsule
 */
router.get('/deals/:dealId/tax/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;

    const projection = await taxProjectionService.getProjectionByDeal(dealId);

    if (!projection) {
      return res.json({
        success: true,
        data: {
          hasProjection: false,
          message: 'No tax projection available'
        }
      });
    }

    res.json({
      success: true,
      data: {
        hasProjection: true,
        projected_total_tax: projection.projected_total_tax,
        projected_tax_per_unit: projection.projected_tax_per_unit,
        effective_tax_rate: projection.effective_tax_rate,
        delta_amount: projection.delta_amount,
        delta_pct: projection.delta_pct,
        current_annual_tax: projection.current_annual_tax
      }
    });
  } catch (error: any) {
    console.error('Get tax summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ─── F9 Forecast routes ───────────────────────────────────────────────────────

/**
 * GET /api/v1/tax/rulesets/coverage
 * Return a coverage map of all loaded rate sheets with metadata.
 * Used by the RATES modal and ops dashboard to see what jurisdictions are live.
 */
router.get('/tax/rulesets/coverage', requireAuth, async (_req: Request, res: Response) => {
  try {
    const sheets = getAllRateSheets();
    const coverage = sheets.map(s => ({
      jurisdiction:         s.jurisdiction,
      year:                 s.year,
      version:              s.version,
      asOf:                 s.as_of,
      validThrough:         s.valid_through,
      sourceCitationsCount: Array.isArray(s.source_citations) ? s.source_citations.length : 0,
    }));
    res.json({ success: true, data: { coverage, totalSheets: sheets.length } });
  } catch (error: any) {
    console.error('Tax rulesets/coverage error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/tax/rate-sheets/:jurisdiction
 * Return the active rate sheet for a jurisdiction (optionally ?year=2026).
 * Falls back to the latest available year when the requested year is absent.
 */
router.get('/tax/rate-sheets/:jurisdiction', requireAuth, async (req: Request, res: Response) => {
  try {
    const { jurisdiction } = req.params;
    const jur = jurisdiction.toLowerCase();
    const requestedYear = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    const sheet = getRateSheet(jur, requestedYear);
    if (sheet) {
      return res.json({ success: true, data: sheet, meta: { servedYear: requestedYear } });
    }

    // Fall back to latest available year for this jurisdiction
    const all = getAllRateSheets().filter(s => s.jurisdiction === jur).sort((a, b) => b.year - a.year);
    if (all.length > 0) {
      return res.json({
        success: true,
        data: all[0],
        meta: { requestedYear, servedYear: all[0].year, note: 'requested year not found; serving latest' },
      });
    }

    res.status(404).json({ success: false, error: `No rate sheet found for jurisdiction '${jurisdiction}'` });
  } catch (error: any) {
    console.error('Tax rate-sheets error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/tax/rate-sheets/:jurisdiction/history
 * Return all loaded rate sheet versions for a jurisdiction (all years), newest first.
 */
router.get('/tax/rate-sheets/:jurisdiction/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const { jurisdiction } = req.params;
    const jur = jurisdiction.toLowerCase();

    const history = getAllRateSheets()
      .filter(s => s.jurisdiction === jur)
      .sort((a, b) => b.year - a.year);

    res.json({
      success: true,
      data: { jurisdiction: jur, versions: history, count: history.length },
    });
  } catch (error: any) {
    console.error('Tax rate-sheets/history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/tax/forecast/:dealId
 * Run a fresh taxService.forecast() for a deal and return the full TaxForecast.
 * Accepts optional query params: holdYears, loanAmount (override deal values).
 */
router.get('/tax/forecast/:dealId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;

    const dealResult = await query(
      'SELECT id, state_code, city, target_units, budget, deal_data FROM deals WHERE id = $1',
      [dealId],
    );
    if (!dealResult.rows.length) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    const deal = dealResult.rows[0] as DealRowForTaxContext;

    const holdYears = req.query.holdYears ? parseInt(req.query.holdYears as string) : 10;
    const loanAmountParam = req.query.loanAmount ? Number(req.query.loanAmount) : null;

    // Build typed overrides — all fields are optional in TaxContextOverrides
    const overrides: TaxContextOverrides = {
      holdYears,
      loanAmount: loanAmountParam,
    };

    // Deal-level access control follows project-wide pattern (requireAuth only —
    // no explicit IDOR guard at this layer, consistent with /deals/:dealId/* routes).
    const { ctx, provenance } = await buildTaxContext(deal, overrides);
    const forecast = taxService.forecast(ctx, provenance);

    res.json({
      success: true,
      data: {
        forecast,
        jurisdiction:  forecast.jurisdiction,
        confidence:    forecast.confidence,
        rulesetUsed:   forecast.rulesetUsed,
        jurisdictionMapped: forecast.jurisdictionMapped,
      },
    });
  } catch (error: any) {
    console.error('Tax forecast error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/tax/forecast/:dealId/section/:abcd
 * Return a single section (A/B/C/D) from the tax forecast for a deal.
 * Useful for lazy per-section fetches from the F9 TaxesTab.
 */
router.get('/tax/forecast/:dealId/section/:abcd', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId, abcd } = req.params;
    const section = abcd.toUpperCase();

    if (!['A', 'B', 'C', 'D'].includes(section)) {
      return res.status(400).json({ success: false, error: `Section '${abcd}' must be one of A, B, C, D` });
    }

    const dealResult = await query(
      'SELECT id, state_code, city, target_units, budget, deal_data FROM deals WHERE id = $1',
      [dealId],
    );
    if (!dealResult.rows.length) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    const deal = dealResult.rows[0] as DealRowForTaxContext;

    // Deal-level access control follows project-wide pattern (requireAuth only —
    // no explicit IDOR guard at this layer, consistent with /deals/:dealId/* routes).
    const { ctx, provenance } = await buildTaxContext(deal, {});
    const forecast = taxService.forecast(ctx, provenance);

    const sectionMap: Record<string, unknown> = {
      A: forecast.reTax,
      B: forecast.sectionB,
      C: forecast.sectionC,
      D: forecast.transferTax,
    };

    res.json({
      success: true,
      data: {
        dealId,
        section,
        jurisdiction:      forecast.jurisdiction,
        jurisdictionMapped: forecast.jurisdictionMapped,
        confidence:        forecast.confidence,
        sectionData:       sectionMap[section],
      },
    });
  } catch (error: any) {
    console.error('Tax forecast/section error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
