/**
 * Exit Strategy Service — M20
 *
 * Derives exit cap rate, terminal value, hold period, and disposition costs
 * for the F9 proforma. Implements the exitCapRate.yaml Tier-5 formula:
 *
 *   exit_cap = going_in_cap + base_expansion_bps + macro_modifier_bps + dev_premium_bps
 *
 * Tier hierarchy (exitCapRate.yaml §sourcePreference):
 *   Tier 3:   M26 archive submarket cap rate trajectory (not yet wired — placeholder)
 *   Tier 2.5: Profile cluster exit cap achieved by product type (placeholder)
 *   Tier 4:   Broker OM going-in cap + framing (placeholder)
 *   Tier 5:   Going-in cap + 25bps (DEFAULT — this service)
 *
 * A +25bps minimum expansion is applied per the yaml spec note:
 *   "Never use going-in cap as exit cap — always add basis points for uncertainty
 *    (25bps minimum, 50bps for development/lease-up)."
 *
 * Macro modifier: when CPI YoY > 4%, rate environment pressure adds +10bps;
 * when CPI < 2%, compressive environment subtracts −5bps.
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
  provenance: {
    goingInCap: number;
    baseExpansionBps: number;
    macroModifierBps: number;
    devPremiumBps: number;
    cpiYoY: number | null;
    cpiPeriod: string | null;
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export class ExitStrategyService {
  constructor(private pool: Pool) {}

  /**
   * Derive exit cap rate + disposition costs for a deal.
   *
   * When year1NOI is supplied, also computes terminalNOI (applying a simple
   * NOI growth proxy) and terminalValue = terminalNOI / exitCapRate.
   *
   * @param inputs      - Deal-level inputs (going-in cap, hold period, etc.)
   * @param year1NOI    - Optional Year-1 NOI for terminal value computation.
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
    const exitCapRate = Math.max(0.02, Math.min(0.12, rawExitCap));

    const holdPeriod = inputs.holdPeriod > 0 ? inputs.holdPeriod : DEFAULT_HOLD_PERIOD_YEARS;

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

    const source =
      `M20 Tier-5: going-in(${(goingIn * 100).toFixed(2)}%)` +
      ` + ${BASE_EXPANSION_BPS}bps base${macroNote}${devNote}` +
      ` = exit(${(exitCapRate * 100).toFixed(2)}%)`;

    logger.debug(
      `[ExitStrategy] dealMode=${inputs.dealMode ?? 'n/a'} state=${stateKey} ` +
      `goingIn=${(goingIn * 100).toFixed(2)}% ` +
      `expansion=${totalExpansionBps}bps → exit=${(exitCapRate * 100).toFixed(2)}% ` +
      `sellingCosts=${(sellingCosts * 100).toFixed(1)}%` +
      (terminalValue ? ` terminalValue=$${Math.round(terminalValue).toLocaleString()}` : '')
    );

    return {
      exitCapRate,
      exitCapSpreadBps: totalExpansionBps,
      sellingCosts,
      holdPeriod,
      terminalNOI,
      terminalValue,
      source,
      confidence: 0.70,
      provenance: {
        goingInCap: goingIn,
        baseExpansionBps: BASE_EXPANSION_BPS,
        macroModifierBps,
        devPremiumBps,
        cpiYoY,
        cpiPeriod,
      },
    };
  }
}

export function getExitStrategyService(pool: Pool): ExitStrategyService {
  return new ExitStrategyService(pool);
}
