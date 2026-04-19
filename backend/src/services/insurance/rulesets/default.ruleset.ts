/**
 * Default Insurance Ruleset — Generic Fallback
 *
 * Used when the deal's jurisdiction doesn't match any specific ruleset.
 * Conservative national average multifamily insurance estimate.
 *
 * National average (NMHC 2024): $500 – $900/unit/yr depending on age, location, type.
 * Default benchmark: $700/unit — conservative mid-range.
 */

import type { InsuranceContext, InsuranceRuleset, InsuranceCoverage, InsuranceEscalation } from '../types';

export const defaultInsuranceRuleset: InsuranceRuleset = {
  jurisdiction: 'default',

  benchmarkPerUnit(_ctx: InsuranceContext): InsuranceCoverage[] {
    return [
      {
        name: 'Property (All-Risk)',
        description: 'Building replacement cost — generic national average',
        estimatedAnnualCostPerUnit: 450,
        required: true,
        notes: 'Upload actual insurance policy for jurisdiction-specific estimate',
      },
      {
        name: 'General Liability',
        description: 'Premises liability',
        estimatedAnnualCostPerUnit: 100,
        required: true,
        notes: null,
      },
      {
        name: 'Flood / Specialty',
        description: 'Flood and specialty peril coverage (if applicable)',
        estimatedAnnualCostPerUnit: 80,
        required: false,
        notes: 'Check FEMA flood zone designation',
      },
      {
        name: 'Umbrella',
        description: 'Excess liability',
        estimatedAnnualCostPerUnit: 35,
        required: false,
        notes: null,
      },
    ];
  },

  escalationRate(_ctx: InsuranceContext): InsuranceEscalation {
    return {
      baseRate: 0.030,
      rationale: 'National average long-run insurance escalation 2.5-3.5%/yr',
      recentTrend: 'Post-2022 market hardening; most markets stabilizing 2024',
    };
  },

  requiresInputs(): string[] {
    return ['units', 'yearBuilt'];
  },

  dataSourceHints(): string[] {
    return [
      'Upload actual insurance policy for accurate jurisdiction-specific projection.',
      'NMHC Multifamily Insurance Survey: https://www.nmhc.org/',
    ];
  },
};
