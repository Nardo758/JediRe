/**
 * Insurance Service — Main Entry Point
 *
 * Single entry point for all insurance benchmark calculations.
 *
 * Usage:
 *   import { insuranceService } from '../insurance/insuranceService';
 *   const forecast = insuranceService.forecast(ctx);
 *
 * Primary consumers:
 *   - CashFlow Agent: benchmarks operator-provided T-12 insurance vs. market rate
 *   - Proforma adjustment service: provides platform insurance value when T-12 is absent
 */

import { resolveInsuranceRuleset } from './resolver';
import type { InsuranceContext, InsuranceForecast } from './types';

export { InsuranceContext, InsuranceForecast } from './types';

const FLAG_LOW_THRESHOLD = 0.75;   // T-12 < 75% of benchmark → flagLow
const FLAG_HIGH_THRESHOLD = 1.50;  // T-12 > 150% of benchmark → flagHigh

export const insuranceService = {
  /**
   * Produce an insurance benchmark forecast for a deal.
   *
   * @param ctx  Deal-level insurance context. See InsuranceContext for field docs.
   * @returns    InsuranceForecast — benchmark, components, escalation, flags
   */
  forecast(ctx: InsuranceContext): InsuranceForecast {
    const ruleset = resolveInsuranceRuleset(ctx.state, ctx.county);
    const components = ruleset.benchmarkPerUnit(ctx);

    const benchmarkPerUnit = components.reduce((sum, c) => sum + c.estimatedAnnualCostPerUnit, 0);
    const benchmarkAnnualTotal = Math.round(benchmarkPerUnit * ctx.units);

    const escalation = ruleset.escalationRate(ctx);

    const t12PerUnit = ctx.t12InsuranceAnnual != null && ctx.units > 0
      ? ctx.t12InsuranceAnnual / ctx.units
      : null;

    const t12VsBenchmarkPct = t12PerUnit != null && benchmarkPerUnit > 0
      ? (t12PerUnit - benchmarkPerUnit) / benchmarkPerUnit
      : null;

    const ratio = t12PerUnit != null ? t12PerUnit / benchmarkPerUnit : null;
    const flagLow = ratio != null ? ratio < FLAG_LOW_THRESHOLD : false;
    const flagHigh = ratio != null ? ratio > FLAG_HIGH_THRESHOLD : false;

    const flagNotes: string[] = [];
    if (flagLow && t12PerUnit != null) {
      flagNotes.push(
        `T-12 insurance ($${Math.round(t12PerUnit).toLocaleString()}/unit) is ${Math.round((1 - ratio!) * 100)}% below the ${ruleset.jurisdiction} benchmark ($${Math.round(benchmarkPerUnit).toLocaleString()}/unit). Possible underinsurance — verify coverage limits.`,
      );
    }
    if (flagHigh && t12PerUnit != null) {
      flagNotes.push(
        `T-12 insurance ($${Math.round(t12PerUnit).toLocaleString()}/unit) is ${Math.round((ratio! - 1) * 100)}% above the ${ruleset.jurisdiction} benchmark ($${Math.round(benchmarkPerUnit).toLocaleString()}/unit). Investigate whether coverage is appropriate or operator is over-insured.`,
      );
    }
    const requiredMissing = components
      .filter(c => c.required && c.estimatedAnnualCostPerUnit > 0 && t12PerUnit != null && t12PerUnit < benchmarkPerUnit * 0.5)
      .map(c => c.name);
    if (requiredMissing.length > 0 && flagLow) {
      flagNotes.push(`Required coverages that may be missing or underpriced: ${requiredMissing.join(', ')}.`);
    }

    return {
      jurisdiction: `${ctx.state || 'unknown'}${ctx.county ? `-${ctx.county}` : ''}`,
      rulesetUsed: ruleset.jurisdiction,
      benchmarkPerUnit,
      benchmarkAnnualTotal,
      components,
      escalation,
      t12PerUnit,
      t12VsBenchmarkPct,
      flagLow,
      flagHigh,
      flagNotes,
      dataSourceHints: ruleset.dataSourceHints(),
    };
  },
};
