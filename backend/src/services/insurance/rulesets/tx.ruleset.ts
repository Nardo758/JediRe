/**
 * Texas Insurance Ruleset
 *
 * TX multifamily insurance drivers:
 * - Hail and wind coverage is the primary elevated cost driver (large storm events)
 * - No mandatory windstorm insurance (no Citizens-equivalent in TX)
 * - Flood insurance required in FEMA SFHAs (Harris County especially)
 * - Market competitive — lower premiums than FL coastal but elevated vs. national avg
 *
 * Benchmark estimates (FY2024 multifamily; per unit per year):
 *   Dallas metro:   $700 – $900/unit
 *   Houston metro:  $800 – $1,100/unit (elevated flood + hail risk)
 *   Other TX:       $600 – $800/unit
 *   Conservative underwriting default: $800/unit
 *
 * Sources: Marcus & Millichap TX Insurance Survey 2024; NMHC Insurance Benchmarking;
 *          TX Department of Insurance commercial property data.
 */

import type { InsuranceContext, InsuranceRuleset, InsuranceCoverage, InsuranceEscalation } from '../types';

const TX_FLOOD_COUNTIES = new Set(['harris', 'fort bend', 'montgomery', 'brazoria', 'galveston']);

function isElevatedFlood(ctx: InsuranceContext): boolean {
  if (ctx.floodZone?.startsWith('A') || ctx.floodZone?.startsWith('V')) return true;
  return TX_FLOOD_COUNTIES.has(ctx.county?.toLowerCase().trim() ?? '');
}

export const txInsuranceRuleset: InsuranceRuleset = {
  jurisdiction: 'TX',

  benchmarkPerUnit(ctx: InsuranceContext): InsuranceCoverage[] {
    const elevatedFlood = isElevatedFlood(ctx);
    const isDallas = ctx.county?.toLowerCase().includes('dallas');

    return [
      {
        name: 'Property (All-Risk incl. Hail/Wind)',
        description: 'Building replacement cost — includes hail and wind (major TX peril)',
        estimatedAnnualCostPerUnit: isDallas ? 480 : 520,
        required: true,
        notes: 'TX hail losses have increased premiums 15-25% since 2020 in DFW and Houston',
      },
      {
        name: 'General Liability',
        description: 'Premises liability, slip-and-fall, bodily injury',
        estimatedAnnualCostPerUnit: 100,
        required: true,
        notes: null,
      },
      {
        name: 'Flood Insurance (NFIP / Private)',
        description: 'Flood damage coverage',
        estimatedAnnualCostPerUnit: elevatedFlood ? 250 : 50,
        required: elevatedFlood,
        notes: elevatedFlood
          ? 'Harris County/Houston metro: elevated flood risk; NFIP or private flood mandatory'
          : 'Low flood risk — optional but recommended',
      },
      {
        name: 'Umbrella',
        description: 'Excess liability layer',
        estimatedAnnualCostPerUnit: 35,
        required: false,
        notes: null,
      },
    ];
  },

  escalationRate(ctx: InsuranceContext): InsuranceEscalation {
    return {
      baseRate: 0.030,
      rationale: 'TX market moderating after 2022-23 hail-driven hardening; long-run 2.5-3.5%/yr',
      recentTrend: 'DFW: +8-12% in 2023, stabilizing 2024; Houston: elevated due to flood risk history',
    };
  },

  requiresInputs(): string[] {
    return ['units', 'county', 'floodZone', 'yearBuilt', 'constructionType'];
  },

  dataSourceHints(): string[] {
    return [
      'TX Department of Insurance: https://www.tdi.texas.gov/',
      'FEMA Flood Zone Maps: https://msc.fema.gov/',
      'NMHC Insurance Benchmarking: https://www.nmhc.org/',
    ];
  },
};
