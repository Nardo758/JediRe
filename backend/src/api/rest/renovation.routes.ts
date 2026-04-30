/**
 * Renovation Data API — serves renovation/value-add data for F9 enhancements
 *
 * Returns:
 *   - Premium tier config (Light/Moderate/Heavy/Gut cost + premium ranges)
 *   - Premium ramp/fade curve (years 1–5 rent uplift with fade)
 *   - deal_capex_items rows (real line items with vendor, dates, % complete)
 *   - LIUS strategy overrides for renovation (if any)
 *   - year_renovated from deal record
 *   - Renovation pace units/month from valueAdd.yaml defaults
 *
 * Routes:
 *   GET  /api/v1/deals/:dealId/renovation  — Full renovation data
 *   POST /api/v1/deals/:dealId/renovation/premium  — Override premium tier
 *   POST /api/v1/deals/:dealId/renovation/capex-item — Add/update capex line item
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

// ─── Premium tier config (mirroring renovationPremium.yaml + valueAdd.yaml) ──

export interface PremiumTier {
  id: string;
  label: string;
  costRange: [number, number]; // [$min/unit, $max/unit]
  premiumRange: [number, number]; // [min%, max%] (as decimals)
  premiumCenter: number; // default premium (decimal)
  premiumFadePct: number; // % of premium that fades over time (decimal)
  premiumFadeYears: number; // years over which fade occurs
  absorptionUnitsMonth: number; // default absorption rate
  rampMonths: number; // months to reach full premium
}

export const PREMIUM_TIERS: PremiumTier[] = [
  {
    id: 'light',
    label: 'Light',
    costRange: [5000, 15000],
    premiumRange: [0.10, 0.20],
    premiumCenter: 0.15,
    premiumFadePct: 0.20,
    premiumFadeYears: 3,
    absorptionUnitsMonth: 25,
    rampMonths: 3,
  },
  {
    id: 'moderate',
    label: 'Moderate',
    costRange: [15000, 30000],
    premiumRange: [0.20, 0.35],
    premiumCenter: 0.28,
    premiumFadePct: 0.30,
    premiumFadeYears: 4,
    absorptionUnitsMonth: 18,
    rampMonths: 4,
  },
  {
    id: 'heavy',
    label: 'Heavy',
    costRange: [30000, 75000],
    premiumRange: [0.35, 0.60],
    premiumCenter: 0.45,
    premiumFadePct: 0.35,
    premiumFadeYears: 5,
    absorptionUnitsMonth: 12,
    rampMonths: 5,
  },
  {
    id: 'gut',
    label: 'Gut Rehab',
    costRange: [75000, 150000],
    premiumRange: [0.50, 0.80],
    premiumCenter: 0.65,
    premiumFadePct: 0.40,
    premiumFadeYears: 5,
    absorptionUnitsMonth: 8,
    rampMonths: 6,
  },
];

// ─── Premium ramp curve calculation ──────────────────────────────────────────

export interface PremiumRampPoint {
  year: number;
  /** The premium as a decimal multiplier over base rent (0.15 = 15% lift) */
  premiumDecimal: number;
  /** The premium expressed as a $/unit monthly rent increment (null if base rent unknown) */
  premiumDeltaDollar: number | null;
  /** What % of the target premium is realized this year */
  realizationPct: number;
}

/**
 * Calculate the year-over-year premium ramp + fade curve
 *
 * Logic:
 *   Year 1: premium == target × (monthsRemainingInYear / 12 × absorption_ramp)
 *   Year 2: premium == target × absorption_ramp
 *   Year 3: premium == target × absorption_ramp × fade_factor^1
 *   Year 4: premium == target × absorption_ramp × fade_factor^2
 *   Year 5: premium == target × absorption_ramp × fade_factor^3
 */
export function calcPremiumRamp(
  tier: PremiumTier,
  baseMonthlyRent: number | null,
  unitsBeingRenovated: number,
): PremiumRampPoint[] {
  const targetPremium = tier.premiumCenter;
  const rampMonths = tier.rampMonths;
  const fadePerYear = 1 - (tier.premiumFadePct / tier.premiumFadeYears);

  const years: PremiumRampPoint[] = [];

  for (let y = 1; y <= 5; y++) {
    let realizationPct: number;
    let premiumDecimal: number;

    if (y === 1) {
      // Year 1: ramp up during first `rampMonths` months, then full premium rest of year
      // Average: (@ months of ramp) × (% of year in ramp) + (full premium × rest of year)
      const rampFraction = Math.min(rampMonths / 12, 1);
      realizationPct = 0.5; // ~50% of units done mid-year on average
      premiumDecimal = targetPremium * realizationPct;
    } else if (y === 2) {
      // Year 2: all units fully renovated, full premium
      realizationPct = 1.0;
      premiumDecimal = targetPremium;
    } else if (y === 3) {
      // Year 3+: fade starts
      const fadeFactor = Math.pow(fadePerYear, y - 2);
      realizationPct = fadeFactor;
      premiumDecimal = targetPremium * fadeFactor;
    } else {
      const fadeFactor = Math.pow(fadePerYear, y - 2);
      realizationPct = fadeFactor;
      premiumDecimal = targetPremium * fadeFactor;
    }

    const premiumDeltaDollar = baseMonthlyRent != null
      ? Math.round(premiumDecimal * baseMonthlyRent)
      : null;

    years.push({ year: y, premiumDecimal, premiumDeltaDollar, realizationPct });
  }

  return years;
}

// ─── Route factory ──────────────────────────────────────────────────────────

export function createRenovationRoutes(pool: Pool): Router {
  const router = Router({ mergeParams: true });

  /**
   * GET /api/v1/deals/:dealId/renovation
   *
   * Returns full renovation data package for F9 enhancements.
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;
      const userId = (req as any).user?.userId || (req.query.user_id as string) || 'demo-user';

      // 1. Deal info (year_renovated, deal_data rehab cost)
      const dealResult = await pool.query(
        `SELECT id, name, year_renovated, deal_data, data, project_type, target_units
         FROM deals WHERE id = $1`,
        [dealId]
      );
      if (dealResult.rows.length === 0) {
        return res.status(404).json({ error: 'Deal not found' });
      }
      const deal = dealResult.rows[0];
      const dealData = deal.deal_data || deal.data || {};
      const totalUnits = deal.target_units || 0;

      // 2. Capex items from deal_capex_items table
      const capexItemsResult = await pool.query(
        `SELECT id, category, description, vendor, budgeted, actual, remaining,
                start_date, completion_date, completion_pct, status, source
         FROM deal_capex_items
         WHERE deal_id = $1 AND deleted_at IS NULL
         ORDER BY category, start_date NULLS LAST, created_at`,
        [dealId]
      );

      // 3. Current premium override (from strategy overrides if stored)
      let currentTierId: string | null = null;
      let overridePremium: number | null = null;
      const overrideResult = await pool.query(
        `SELECT override_data FROM strategy_overrides
         WHERE deal_id = $1 AND strategy_id = 'strategy.renovationPremium'
         ORDER BY created_at DESC LIMIT 1`,
        [dealId]
      );
      if (overrideResult.rows.length > 0) {
        const od = overrideResult.rows[0].override_data;
        currentTierId = od?.tierId || null;
        overridePremium = od?.manualPremium ?? null;
      }

      // 4. Calculate default premium curve
      const defaultTier: PremiumTier = currentTierId
        ? PREMIUM_TIERS.find(t => t.id === currentTierId) || PREMIUM_TIERS[1] // moderate default
        : PREMIUM_TIERS[1]; // moderate default

      const inPlaceRent = dealData.currentRent
        || dealData.avg_in_place_rent
        || dealData.avgRent
        || null;

      // Estimate units being renovated (could be totalUnits or a subset)
      const renoUnits = dealData.renovationUnits || Math.round(totalUnits * 0.8); // 80% default

      const premiumRamp = calcPremiumRamp(
        {
          ...defaultTier,
          premiumCenter: overridePremium ?? defaultTier.premiumCenter,
        },
        inPlaceRent,
        renoUnits,
      );

      // 5. Build response
      res.json({
        success: true,
        data: {
          dealId,
          dealName: deal.name,
          totalUnits,
          yearRenovated: deal.year_renovated || null,
          inPlaceRent,
          renovationUnits: renoUnits,

          // Premium configuration
          currentTierId,
          availableTiers: PREMIUM_TIERS.map(t => ({
            id: t.id,
            label: t.label,
            costRange: t.costRange,
            premiumRange: t.premiumRange,
            premiumCenter: t.premiumCenter,
            absorptionUnitsMonth: t.absorptionUnitsMonth,
          })),
          defaultTier,
          overridePremium,

          // Premium ramp curve
          premiumRamp: premiumRamp.map(p => ({
            ...p,
            premiumPct: Math.round(p.premiumDecimal * 100),
            premiumDeltaDollar: p.premiumDeltaDollar,
          })),

          // Capex line items
          capexItems: capexItemsResult.rows.map(r => ({
            id: r.id,
            category: r.category,
            description: r.description,
            vendor: r.vendor,
            budgeted: r.budgeted,
            actual: r.actual,
            remaining: r.remaining,
            startDate: r.start_date,
            completionDate: r.completion_date,
            completionPct: r.completion_pct,
            status: r.status,
            source: r.source,
          })),

          // Capex totals
          capexSummary: {
            totalBudgeted: capexItemsResult.rows.reduce((s, r) => s + (r.budgeted || 0), 0),
            totalActual: capexItemsResult.rows.reduce((s, r) => s + (r.actual || 0), 0),
            totalRemaining: capexItemsResult.rows.reduce((s, r) => s + (r.remaining || 0), 0),
          },

          // Rehab cost from deal_data
          rehabCost: dealData.rehab_cost || dealData.renovation_cost || null,
          rehabCostPerUnit: dealData.rehab_cost_per_unit || null,
        },
      });
    } catch (error: any) {
      console.error('Error getting renovation data:', error);
      res.status(500).json({ error: error.message || 'Failed to get renovation data' });
    }
  });

  /**
   * POST /api/v1/deals/:dealId/renovation/premium
   *
   * Override the renovation premium tier and/or manual premium percentage.
   * Writes a strategy override and returns the new ramp curve.
   *
   * Body: { tierId: 'light' | 'moderate' | 'heavy' | 'gut', manualPremium?: number }
   */
  router.post('/premium', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;
      const { tierId, manualPremium } = req.body;
      const userId = (req as any).user?.userId || 'demo-user';

      if (!tierId || !['light', 'moderate', 'heavy', 'gut'].includes(tierId)) {
        return res.status(400).json({ error: 'tierId must be one of: light, moderate, heavy, gut' });
      }

      const tier = PREMIUM_TIERS.find(t => t.id === tierId)!;
      const effectivePremium = manualPremium != null ? manualPremium : tier.premiumCenter;

      // Wipe previous override, insert new one
      await pool.query(
        `DELETE FROM strategy_overrides WHERE deal_id = $1 AND strategy_id = 'strategy.renovationPremium'`,
        [dealId]
      );
      await pool.query(
        `INSERT INTO strategy_overrides (deal_id, strategy_id, override_data, created_by, created_at)
         VALUES ($1, 'strategy.renovationPremium', $2::jsonb, $3, NOW())`,
        [dealId, JSON.stringify({ tierId, manualPremium, effectivePremium }), userId]
      );

      // Get in-place rent for dollar calc
      const dealResult = await pool.query(
        `SELECT deal_data, data FROM deals WHERE id = $1`,
        [dealId]
      );
      const dealData = dealResult.rows[0]?.deal_data || dealResult.rows[0]?.data || {};
      const inPlaceRent = dealData.currentRent
        || dealData.avg_in_place_rent
        || dealData.avgRent
        || null;

      const renoUnits = dealData.renovationUnits || null;

      const premiumRamp = calcPremiumRamp(
        { ...tier, premiumCenter: effectivePremium },
        inPlaceRent,
        renoUnits || 100,
      );

      res.json({
        success: true,
        data: {
          tierId,
          effectivePremium,
          premiumRamp: premiumRamp.map(p => ({
            ...p,
            premiumPct: Math.round(p.premiumDecimal * 100),
          })),
        },
      });
    } catch (error: any) {
      console.error('Error setting premium override:', error);
      res.status(500).json({ error: error.message || 'Failed to set premium override' });
    }
  });

  /**
   * POST /api/v1/deals/:dealId/renovation/capex-item
   *
   * Add or update a deal_capex_items row.
   *
   * Body (add): { category, description, vendor, budgeted, startDate?, completionDate? }
   * Body (update): { id, ...fields }
   *
   * The category field supports values from the LIUS strategy YAMLs:
   *   'unit_upgrades', 'common_area', 'deferred_maintenance', 'reposition',
   *   'amenity', 'infrastructure', 'other'
   * It also accepts the broader TDC categories for development deals:
   *   'hard_cost', 'soft_cost', 'contingency', 'developer_fee', 'land'
   */
  router.post('/capex-item', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;
      const { id, category, description, vendor, budgeted, startDate, completionDate } = req.body;
      const userId = (req as any).user?.userId || 'demo-user';

      if (id) {
        // UPDATE existing row
        const updates: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (category != null) { updates.push(`category = $${idx++}`); values.push(category); }
        if (description != null) { updates.push(`description = $${idx++}`); values.push(description); }
        if (vendor != null) { updates.push(`vendor = $${idx++}`); values.push(vendor); }
        if (budgeted != null) { updates.push(`budgeted = $${idx++}`); values.push(budgeted); }
        if (startDate != null) { updates.push(`start_date = $${idx++}`); values.push(startDate); }
        if (completionDate != null) { updates.push(`completion_date = $${idx++}`); values.push(completionDate); }
        updates.push(`updated_by = $${idx++}`); values.push(userId);
        updates.push(`updated_at = NOW()`);

        values.push(id);
        await pool.query(
          `UPDATE deal_capex_items SET ${updates.join(', ')} WHERE id = $${idx}`,
          values
        );

        const result = await pool.query(`SELECT * FROM deal_capex_items WHERE id = $1`, [id]);
        return res.json({ success: true, data: result.rows[0] });
      }

      // INSERT new row
      const itemId = randomUUID();
      const validCategories = [
        'unit_upgrades', 'common_area', 'deferred_maintenance',
        'reposition', 'amenity', 'infrastructure', 'other',
        'hard_cost', 'soft_cost', 'contingency', 'developer_fee', 'land',
      ];
      const cat = validCategories.includes(category) ? category : 'other';

      const result = await pool.query(
        `INSERT INTO deal_capex_items (id, deal_id, category, description, vendor, budgeted, start_date, completion_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [itemId, dealId, cat, description || null, vendor || null,
         budgeted != null ? budgeted : 0,
         startDate || null, completionDate || null, userId]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      console.error('Error managing capex item:', error);
      res.status(500).json({ error: error.message || 'Failed to manage capex item' });
    }
  });

  return router;
}
