/**
 * Exit Strategy Service — M20
 *
 * Derives exit cap rate, terminal value, hold period, and disposition costs
 * for the F9 proforma. Implements the exitCapRate.yaml source-preference tiers:
 *
 *   Tier 3:   M26 archive submarket cap rate trajectory (placeholder — future)
 *   Tier 2.5: Profile cluster exit cap from archive_assumption_benchmarks (ACTIVE — comp-bounded)
 *   Tier 4:   Broker OM going-in cap (placeholder — future)
 *   Tier 5:   Going-in cap + 25bps base expansion (DEFAULT fallback)
 *
 * Comp bounding (Tier 2.5):
 *   When archive_assumption_benchmarks contains exit_cap_rate data for the
 *   deal's asset class / submarket, the computed exit cap is clamped within
 *   [P25, P75] of the comp distribution. This prevents outlier scenarios where
 *   a very low or very high going-in cap projects an implausible exit cap.
 *
 * Macro modifier:
 *   CPI YoY → rate-environment proxy: +10bps when CPI > 4%, −5bps when CPI < 2%.
 *
 * Development risk premium (per yaml hard rule):
 *   "50bps minimum for development/lease-up" → +25bps dev premium on top of
 *   the 25bps base expansion = 50bps total for ground_up/redevelopment/development.
 */

import { Pool } from 'pg';
import { MacroIndicatorsService } from './macro-indicators.service';
import { logger } from '../utils/logger';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_GOING_IN_CAP = 0.055;

const BASE_EXPANSION_BPS = 25;

const DEVELOPMENT_RISK_PREMIUM_BPS = 25;

const SELLING_COSTS_BY_STATE: Record<string, number> = {
  FL: 0.025,
  NY: 0.025,
  NJ: 0.023,
  CA: 0.022,
  TX: 0.020,
};
const DEFAULT_SELLING_COSTS = 0.02;

const DEFAULT_HOLD_PERIOD_YEARS = 5;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExitStrategyInputs {
  goingInCapRate: number;
  holdPeriod: number;
  state: string | null;
  dealMode?: string;
  msaGeoId?: string;
  assetClass?: string | null;
  submarket?: string | null;
}

export interface CompCapRateBound {
  p25: number;
  p50: number;
  p75: number;
  nSamples: number;
  source: string;
}

export interface ExitStrategyResult {
  exitCapRate: number;
  exitCapSpreadBps: number;
  sellingCosts: number;
  holdPeriod: number;
  terminalNOI: number | null;
  terminalValue: number | null;
  source: string;
  confidence: number;
  compBound: CompCapRateBound | null;
  provenance: {
    goingInCap: number;
    baseExpansionBps: number;
    macroModifierBps: number;
    devPremiumBps: number;
    cpiYoY: number | null;
    cpiPeriod: string | null;
    compBounded: boolean;
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export class ExitStrategyService {
  constructor(private pool: Pool) {}

  /**
   * Query archive_assumption_benchmarks for exit_cap_rate comp distribution.
   * Returns null when insufficient data exists for bounding.
   */
  private async queryCompCapBound(
    assetClass: string | null | undefined,
    submarket: string | null | undefined,
    state: string | null | undefined,
  ): Promise<CompCapRateBound | null> {
    try {
      const params: unknown[] = ['exit_cap_rate'];
      const whereClauses: string[] = [`assumption_name = $1`];

      if (assetClass) {
        params.push(assetClass);
        whereClauses.push(`(asset_class = $${params.length} OR asset_class IS NULL)`);
      }
      if (submarket) {
        params.push(submarket);
        whereClauses.push(`(submarket_id = $${params.length} OR submarket_id IS NULL)`);
      }

      const result = await this.pool.query(
        `SELECT p25, p50, p75, n_samples, as_of, submarket_id
           FROM archive_assumption_benchmarks
          WHERE ${whereClauses.join(' AND ')}
          ORDER BY
            (CASE WHEN submarket_id IS NOT NULL THEN 0 ELSE 1 END),
            as_of DESC
          LIMIT 1`,
        params,
      );

      const row = result.rows[0];
      if (!row || row.p50 == null) return null;

      const p25 = parseFloat(row.p25);
      const p50 = parseFloat(row.p50);
      const p75 = parseFloat(row.p75);
      const n   = parseInt(row.n_samples, 10);

      if (isNaN(p25) || isNaN(p50) || isNaN(p75) || p25 <= 0 || p75 >= 0.20) return null;

      const scope = row.submarket_id
        ? `${row.submarket_id} submarket`
        : `${state ?? 'national'} market`;
      const asOf = row.as_of?.toISOString?.()?.slice(0, 10) ?? 'unknown';

      return {
        p25,
        p50,
        p75,
        nSamples: isNaN(n) ? 0 : n,
        source: `archive_assumption_benchmarks (exit_cap_rate, ${scope}, n=${n}, as_of=${asOf})`,
      };
    } catch (err: any) {
      logger.debug(`[ExitStrategy] Comp bound query failed: ${err?.message}`);
      return null;
    }
  }

  /**
   * Derive exit cap rate + disposition costs for a deal.
   *
   * When year1NOI is supplied, also computes terminalNOI (applying a simple
   * NOI growth proxy) and terminalValue = terminalNOI / exitCapRate.
   *
   * @param inputs        - Deal-level inputs (going-in cap, hold period, etc.)
   * @param year1NOI      - Optional Year-1 NOI for terminal value computation.
   * @param noiGrowthRate - Average annual NOI growth applied to year1NOI (default 0.03).
   */
  async derive(
    inputs: ExitStrategyInputs,
    year1NOI?: number | null,
    noiGrowthRate = 0.03,
  ): Promise<ExitStrategyResult> {
    const msaGeoId = inputs.msaGeoId ?? 'national';
    const macroSvc = new MacroIndicatorsService(this.pool);

    let macroModifierBps = 0;
    let cpiYoY: number | null = null;
    let cpiPeriod: string | null = null;

    try {
      const cpi = await macroSvc.getLatestCpi(msaGeoId);
      if (cpi) {
        cpiYoY   = cpi.value;
        cpiPeriod = cpi.periodDate;
        if (cpiYoY > 4.0) {
          macroModifierBps = 10;
        } else if (cpiYoY < 2.0) {
          macroModifierBps = -5;
        }
      }
    } catch (err: any) {
      logger.warn(`[ExitStrategy] CPI fetch failed (msaGeoId=${msaGeoId}): ${err?.message}`);
    }

    const isDevelopment =
      inputs.dealMode === 'development' ||
      inputs.dealMode === 'ground_up' ||
      inputs.dealMode === 'redevelopment';
    const devPremiumBps = isDevelopment ? DEVELOPMENT_RISK_PREMIUM_BPS : 0;

    const totalExpansionBps = BASE_EXPANSION_BPS + macroModifierBps + devPremiumBps;

    const goingIn = inputs.goingInCapRate > 0
      ? inputs.goingInCapRate
      : DEFAULT_GOING_IN_CAP;

    const rawExitCap = goingIn + totalExpansionBps / 10_000;

    const holdPeriod = inputs.holdPeriod > 0 ? inputs.holdPeriod : DEFAULT_HOLD_PERIOD_YEARS;

    // Tier 2.5 — comp-implied bounding from archive_assumption_benchmarks
    const compBound = await this.queryCompCapBound(
      inputs.assetClass,
      inputs.submarket,
      inputs.state,
    );

    let exitCapRate = Math.max(0.02, Math.min(0.12, rawExitCap));
    let compBounded = false;

    if (compBound && compBound.nSamples >= 5) {
      if (exitCapRate < compBound.p25) {
        exitCapRate = compBound.p25;
        compBounded = true;
      } else if (exitCapRate > compBound.p75) {
        exitCapRate = compBound.p75;
        compBounded = true;
      }
    }

    const stateKey = (inputs.state ?? '').toUpperCase();
    const sellingCosts = SELLING_COSTS_BY_STATE[stateKey] ?? DEFAULT_SELLING_COSTS;

    let terminalNOI: number | null = null;
    let terminalValue: number | null = null;
    if (year1NOI && year1NOI > 0) {
      terminalNOI  = year1NOI * Math.pow(1 + noiGrowthRate, holdPeriod - 1);
      terminalValue = terminalNOI / exitCapRate;
    }

    const macroNote = macroModifierBps !== 0
      ? ` ${macroModifierBps > 0 ? '+' : ''}${macroModifierBps}bps macro(CPI=${cpiYoY?.toFixed(1)}%)`
      : '';
    const devNote = devPremiumBps > 0
      ? ` +${devPremiumBps}bps dev-premium`
      : '';
    const boundNote = compBounded
      ? ` [comp-bounded to ${(exitCapRate * 100).toFixed(2)}% from raw ${(rawExitCap * 100).toFixed(2)}%]`
      : '';

    const source =
      `M20 Tier-5: going-in(${(goingIn * 100).toFixed(2)}%)` +
      ` + ${BASE_EXPANSION_BPS}bps base${macroNote}${devNote}` +
      ` = exit(${(exitCapRate * 100).toFixed(2)}%)${boundNote}`;

    logger.debug(
      `[ExitStrategy] dealMode=${inputs.dealMode ?? 'n/a'} state=${stateKey} ` +
      `goingIn=${(goingIn * 100).toFixed(2)}% ` +
      `expansion=${totalExpansionBps}bps → raw=${(rawExitCap * 100).toFixed(2)}% ` +
      `→ final=${(exitCapRate * 100).toFixed(2)}% ` +
      `sellingCosts=${(sellingCosts * 100).toFixed(1)}%` +
      (terminalValue ? ` terminalValue=$${Math.round(terminalValue).toLocaleString()}` : '') +
      (compBounded ? ` compBound=[${(compBound!.p25 * 100).toFixed(2)}%,${(compBound!.p75 * 100).toFixed(2)}%]` : '')
    );

    return {
      exitCapRate,
      exitCapSpreadBps: totalExpansionBps,
      sellingCosts,
      holdPeriod,
      terminalNOI,
      terminalValue,
      source,
      confidence: compBounded ? 0.80 : 0.70,
      compBound: compBound ?? null,
      provenance: {
        goingInCap: goingIn,
        baseExpansionBps: BASE_EXPANSION_BPS,
        macroModifierBps,
        devPremiumBps,
        cpiYoY,
        cpiPeriod,
        compBounded,
      },
    };
  }
}

export function getExitStrategyService(pool: Pool): ExitStrategyService {
  return new ExitStrategyService(pool);
}
