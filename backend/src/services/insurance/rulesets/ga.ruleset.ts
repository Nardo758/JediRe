/**
 * Georgia Insurance Ruleset
 *
 * GA multifamily insurance is generally at or below national average:
 * - Wind/hail risk present but lower severity than FL/TX coastal/hail corridors
 * - Flood risk in Fulton/DeKalb urban low-lying areas (but generally moderate)
 * - Competitive market — most major carriers active
 *
 * Benchmark estimates (FY2024 multifamily; per unit per year):
 *   Atlanta metro (Fulton/DeKalb/Gwinnett/Cobb):  $550 – $750/unit
 *   Other GA:    $500 – $650/unit
 *   Conservative underwriting default: $650/unit
 *
 * Sources: CBRE Multifamily Insurance Benchmarks 2024; NMHC data; RealPage analytics.
 */

import type { InsuranceContext, InsuranceRuleset, InsuranceCoverage, InsuranceEscalation } from '../types';

export const gaInsuranceRuleset: InsuranceRuleset = {
  jurisdiction: 'GA',

  benchmarkPerUnit(ctx: InsuranceContext): InsuranceCoverage[] {
    const floodElevated = ctx.floodZone?.startsWith('A') || ctx.floodZone?.startsWith('V');

    return [
      {
        name: 'Property (All-Risk)',
        description: 'Building replacement cost coverage',
        estimatedAnnualCostPerUnit: 380,
        required: true,
        notes: null,
      },
      {
        name: 'General Liability',
        description: 'Premises liability, bodily injury',
        estimatedAnnualCostPerUnit: 100,
        required: true,
        notes: null,
      },
      {
        name: 'Flood Insurance',
        description: 'NFIP or private flood coverage',
        estimatedAnnualCostPerUnit: floodElevated ? 180 : 30,
        required: !!floodElevated,
        notes: floodElevated
          ? `Flood Zone ${ctx.floodZone} — mandatory flood coverage`
          : 'Moderate flood risk in Atlanta lowlands — optional',
      },
      {
        name: 'Umbrella',
        description: 'Excess liability layer',
        estimatedAnnualCostPerUnit: 30,
        required: false,
        notes: null,
      },
    ];
  },

  escalationRate(_ctx: InsuranceContext): InsuranceEscalation {
    return {
      baseRate: 0.025,
      rationale: 'GA insurance market is relatively stable; long-run escalation 2-3%/yr',
      recentTrend: 'Atlanta metro: +5-8% in 2023; moderating 2024',
    };
  },

  requiresInputs(): string[] {
    return ['units', 'county', 'floodZone', 'yearBuilt'];
  },

  dataSourceHints(): string[] {
    return [
      'GA Office of Insurance and Safety Fire Commissioner: https://oci.georgia.gov/',
      'FEMA Flood Zone Maps: https://msc.fema.gov/',
    ];
  },
};
