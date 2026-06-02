/**
 * Repricing Synthesizer Service
 *
 * Rule-based synthesis engine that combines:
 *   1. Monthly actuals (occupancy + effective rent trend)
 *   2. Rent-roll loss-to-lease from rent_roll_units
 *   3. Correlation engine signals (bullish / bearish counts)
 *
 * Output: RepricingCourse with PUSH / HOLD / WATCH verdict, confidence,
 * monthly capture estimate, and a 12-month recommended rent trajectory.
 */

import { query } from '../database/connection';
import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import { CorrelationEngineService } from './correlationEngine.service';

export class DealNotFoundError extends Error {
  constructor(dealId: string) {
    super(`Deal not found: ${dealId}`);
    this.name = 'DealNotFoundError';
  }
}

export interface RepricingCourse {
  signal: 'BUY' | 'HOLD' | 'WATCH';
  confidence: 'high' | 'medium' | 'low';
  captured_per_mo: number;
  net_lift_pct: number;
  recommended_rents: Array<{
    month: string;
    unit_type: string;
    recommended_rent: number;
  }>;
  computed_at: string;
  basis: {
    avg_occupancy: number | null;
    avg_effective_rent: number | null;
    avg_ltl_pct: number | null;
    total_units: number | null;
    bullish_signals: number;
    bearish_signals: number;
  };
}

/**
 * Compute a repricing course recommendation for a deal.
 *
 * @param dealId  - UUID of the deal
 * @param userId  - Authenticated user ID for ownership verification (optional — when
 *                  provided, enforces that the deal belongs to this user; omit only
 *                  in internal/server-side calls where auth is already verified upstream)
 *
 * Steps:
 *   1. Resolve property_id and city/state from the deals table; 404 if not found
 *   2. Pull trailing-6-month monthly actuals for occupancy + rent
 *   3. Pull avg loss-to-lease % from rent_roll_units
 *   4. Run COR-01–30 correlation suite (merged with 1P data when available)
 *   5. Score and emit signal + recommended rent ramp
 */
export async function synthesizeRepricingCourse(dealId: string, userId?: string): Promise<RepricingCourse> {
  const computedAt = new Date().toISOString();

  // ── 1. Resolve deal metadata ──────────────────────────────────────────────
  // Ownership-aware deal lookup: if userId is provided, restrict to deals that
  // belong to that user. If the deal doesn't exist (or belongs to another user),
  // throw DealNotFoundError so the route can return a 404.
  // NOTE: deals.state is the deal stage ('ACTIVE', 'POST_CLOSE', etc.), not a
  // geographic state. Geographic city/state come from the linked properties row.
  const dealRes = userId
    ? await query(
        `SELECT d.property_id,
                COALESCE(p.city, d.city)       AS city,
                COALESCE(p.state_code, 'GA')   AS state
         FROM deals d
         LEFT JOIN properties p ON p.id = d.property_id
         WHERE d.id = $1 AND d.user_id = $2 AND d.archived_at IS NULL
         LIMIT 1`,
        [dealId, userId]
      )
    : await query(
        `SELECT d.property_id,
                COALESCE(p.city, d.city)       AS city,
                COALESCE(p.state_code, 'GA')   AS state
         FROM deals d
         LEFT JOIN properties p ON p.id = d.property_id
         WHERE d.id = $1
         LIMIT 1`,
        [dealId]
      );

  if (!dealRes.rows.length) {
    throw new DealNotFoundError(dealId);
  }

  const propertyId: string | null = (dealRes.rows[0]?.property_id as string) ?? null;
  const city: string   = (dealRes.rows[0]?.city  as string) || 'Atlanta';
  const state: string  = (dealRes.rows[0]?.state as string) || 'GA';

  // ── 2. Monthly actuals (last 6 months, portfolio + deal_id path) ──────────
  let actualsRows: Record<string, unknown>[] = [];
  if (propertyId) {
    const res = await query(
      `SELECT report_month, occupancy_rate, avg_effective_rent, total_units
       FROM deal_monthly_actuals
       WHERE property_id = $1 AND is_portfolio_asset = TRUE AND is_budget = FALSE
       ORDER BY report_month DESC LIMIT 6`,
      [propertyId]
    );
    actualsRows = res.rows as Record<string, unknown>[];
  }

  if (!actualsRows.length) {
    const res = await query(
      `SELECT report_month, occupancy_rate, avg_effective_rent, total_units
       FROM deal_monthly_actuals
       WHERE deal_id = $1 AND is_budget = FALSE
       ORDER BY report_month DESC LIMIT 6`,
      [dealId]
    );
    actualsRows = res.rows as Record<string, unknown>[];
  }

  const avgOccupancy: number | null = actualsRows.length
    ? actualsRows.reduce((s, r) => s + (parseFloat(r.occupancy_rate as string) || 0), 0) / actualsRows.length
    : null;
  const avgEffRent: number | null = actualsRows.length
    ? actualsRows.reduce((s, r) => s + (parseFloat(r.avg_effective_rent as string) || 0), 0) / actualsRows.length
    : null;
  const totalUnits: number | null = actualsRows.length
    ? parseFloat(actualsRows[0].total_units as string) || null
    : null;

  // ── 3. Loss-to-lease from rent_roll_units ─────────────────────────────────
  const ltlRes = await query(
    `SELECT unit_type,
            AVG(loss_to_lease_pct) AS avg_ltl_pct,
            AVG(market_rent)       AS avg_market_rent,
            AVG(current_rent)      AS avg_current_rent,
            COUNT(*)               AS unit_count
     FROM rent_roll_units
     WHERE deal_id = $1 AND status IN ('occupied', 'notice')
     GROUP BY unit_type
     ORDER BY unit_type`,
    [dealId]
  );

  const ltlByType: Array<{
    unit_type: string;
    avg_ltl_pct: number;
    avg_market_rent: number;
    avg_current_rent: number;
    unit_count: number;
  }> = (ltlRes.rows as any[]).map(r => ({
    unit_type:        r.unit_type ?? 'Unknown',
    avg_ltl_pct:      parseFloat(r.avg_ltl_pct)      || 0,
    avg_market_rent:  parseFloat(r.avg_market_rent)   || 0,
    avg_current_rent: parseFloat(r.avg_current_rent)  || 0,
    unit_count:       parseInt(r.unit_count, 10)       || 0,
  }));

  const avgLtlPct: number | null = ltlByType.length
    ? ltlByType.reduce((s, r) => s + r.avg_ltl_pct * r.unit_count, 0) /
      ltlByType.reduce((s, r) => s + r.unit_count, 0)
    : null;

  // ── 4. Correlation signals ─────────────────────────────────────────────────
  let bullishSignals = 0;
  let bearishSignals = 0;
  try {
    const engine = new CorrelationEngineService(getPool());
    const report = await engine.computeCorrelationsWithPropertyData(city, state, {
      avgOccupancy:    avgOccupancy ?? undefined,
      avgEffRent:      avgEffRent   ?? undefined,
    });
    bullishSignals = report.summary.bullishSignals;
    bearishSignals = report.summary.bearishSignals;
  } catch (err) {
    logger.warn('[repricingSynthesizer] Correlation engine unavailable, proceeding without signals:', String(err));
  }

  // ── 5. Signal synthesis ────────────────────────────────────────────────────
  //
  // PUSH: high occupancy (≥93%) + meaningful LTL (≥2%) + bullish ≥ bearish
  // WATCH: low occupancy (<90%) OR strongly bearish (bearish > bullish + 3)
  // HOLD: everything else
  //
  const occ     = avgOccupancy ?? 0;
  const ltl     = avgLtlPct   ?? 0;
  const signalBalance = bullishSignals - bearishSignals;

  let signal: 'BUY' | 'HOLD' | 'WATCH';
  let confidence: 'high' | 'medium' | 'low';

  if (occ >= 0.93 && ltl >= 2.0 && signalBalance >= 0) {
    signal = 'BUY';
    confidence = (occ >= 0.95 && ltl >= 3.0 && signalBalance >= 3) ? 'high' : 'medium';
  } else if (occ < 0.90 || signalBalance < -3) {
    signal = 'WATCH';
    confidence = (occ < 0.87 || signalBalance < -5) ? 'high' : 'medium';
  } else {
    signal = 'HOLD';
    confidence = actualsRows.length >= 4 ? 'medium' : 'low';
  }

  // Fallback when no actuals are available — insufficient data → HOLD / low
  if (avgOccupancy == null && avgEffRent == null && !ltlByType.length) {
    signal = 'HOLD';
    confidence = 'low';
  }

  // ── 6. Net lift + monthly capture ─────────────────────────────────────────
  //
  // Net lift = weighted LTL capture rate:
  //   PUSH: capture 60% of LTL over 12 months  → net_lift_pct = ltl * 0.60 / 100
  //   HOLD: capture 30%
  //   WATCH: preserve / no lift (0%)
  //
  const captureRate = signal === 'PUSH' ? 0.60 : signal === 'HOLD' ? 0.30 : 0;
  const netLiftPct  = (ltl / 100) * captureRate;
  const capturedPerMo = avgEffRent != null && totalUnits != null
    ? Math.round(avgEffRent * totalUnits * netLiftPct / 12)
    : 0;

  // ── 7. Recommended rents — 12-month ramp per unit type ───────────────────
  const recommendedRents: RepricingCourse['recommended_rents'] = [];
  const now = new Date();

  const typesToRamp = ltlByType.length
    ? ltlByType
    : [{ unit_type: 'All', avg_current_rent: avgEffRent ?? 0, avg_market_rent: (avgEffRent ?? 0) * 1.03, avg_ltl_pct: ltl, unit_count: totalUnits ?? 1 }];

  for (const t of typesToRamp) {
    const baseRent   = t.avg_current_rent || (avgEffRent ?? 0);
    const targetRent = t.avg_market_rent  || baseRent * (1 + (t.avg_ltl_pct / 100));

    for (let mo = 1; mo <= 12; mo++) {
      const d = new Date(now.getFullYear(), now.getMonth() + mo, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      // Linear ramp: achieve captureRate of the spread by month 12.
      // Only ramp upward — never recommend a rent below the current base.
      const rampFraction = (mo / 12) * captureRate;
      const rawRent = baseRent + (targetRent - baseRent) * rampFraction;
      const recommendedRent = Math.round(Math.max(baseRent, rawRent));

      recommendedRents.push({
        month:            monthKey,
        unit_type:        t.unit_type,
        recommended_rent: recommendedRent,
      });
    }
  }

  return {
    signal,
    confidence,
    captured_per_mo:   capturedPerMo,
    net_lift_pct:      netLiftPct,
    recommended_rents: recommendedRents,
    computed_at:       computedAt,
    basis: {
      avg_occupancy:    avgOccupancy,
      avg_effective_rent: avgEffRent,
      avg_ltl_pct:      avgLtlPct,
      total_units:      totalUnits,
      bullish_signals:  bullishSignals,
      bearish_signals:  bearishSignals,
    },
  };
}
