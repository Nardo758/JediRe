/**
 * Florida Insurance Ruleset
 *
 * FL multifamily insurance is materially higher than national averages due to:
 * - Hurricane/windstorm exposure (mandatory Citizens or private wind coverage)
 * - Flood insurance requirements (FEMA NFIP or private flood)
 * - Property insurance market hardening (2020-2024: +20-30%/yr in coastal markets)
 *
 * Benchmark estimates (FY2024 multifamily; per unit per year):
 *   Non-coastal inland:  $1,200 – $1,500/unit (prop + GL + flood low-risk)
 *   Coastal (Miami-Dade, Broward, Palm Beach):  $2,500 – $3,500/unit (incl. wind rider)
 *   Conservative underwriting default: $1,800/unit (blended statewide)
 *
 * Sources: CBRE FL Insurance Benchmarks Q4 2024; FNMA DUS guidelines;
 *          Citizens Property Insurance Corp rate filings 2023-24.
 */

import type { InsuranceContext, InsuranceRuleset, InsuranceCoverage, InsuranceEscalation } from '../types';

const FL_COASTAL_COUNTIES = new Set([
  'miami-dade', 'broward', 'palm beach', 'pinellas', 'hillsborough',
  'sarasota', 'lee', 'collier', 'monroe', 'charlotte',
  'brevard', 'indian river', 'st. lucie', 'martin',
  'volusia', 'flagler', 'st. johns', 'duval', 'nassau',
]);

function isCoastalCounty(ctx: InsuranceContext): boolean {
  if (ctx.isCoastal === true) return true;
  if (ctx.isCoastal === false) return false;
  const county = ctx.county?.toLowerCase().trim() ?? '';
  return FL_COASTAL_COUNTIES.has(county);
}

export const flInsuranceRuleset: InsuranceRuleset = {
  jurisdiction: 'FL',

  benchmarkPerUnit(ctx: InsuranceContext): InsuranceCoverage[] {
    const coastal = isCoastalCounty(ctx);

    const coverages: InsuranceCoverage[] = [
      {
        name: 'Property (All-Risk)',
        description: 'Building replacement cost coverage — fire, theft, vandalism, collapse',
        estimatedAnnualCostPerUnit: coastal ? 1_200 : 750,
        required: true,
        notes: coastal ? 'Coastal markets face hard market pricing (2022-2024 +30% cumulative)' : null,
      },
      {
        name: 'Windstorm / Hurricane',
        description: 'Named storm wind damage — often a separate rider or Citizens policy in FL',
        estimatedAnnualCostPerUnit: coastal ? 900 : 250,
        required: true,
        notes: coastal ? 'Mandatory in SFHA and coastal exposure zones; Citizens rates filed 2024' : 'Required statewide; lower rates inland',
      },
      {
        name: 'General Liability',
        description: 'Premises liability, slip-and-fall, bodily injury',
        estimatedAnnualCostPerUnit: 120,
        required: true,
        notes: null,
      },
      {
        name: 'Flood Insurance (NFIP / Private)',
        description: 'Flood damage — separate from windstorm; required in FEMA special flood hazard areas',
        estimatedAnnualCostPerUnit: coastal ? 280 : 80,
        required: coastal,
        notes: ctx.floodZone?.startsWith('A') || ctx.floodZone?.startsWith('V')
          ? `Flood Zone ${ctx.floodZone} — mandatory lender-required flood coverage`
          : coastal ? 'Coastal exposure — flood coverage strongly recommended' : 'Low flood risk area — optional',
      },
      {
        name: 'Umbrella',
        description: 'Excess liability layer above GL',
        estimatedAnnualCostPerUnit: 40,
        required: false,
        notes: 'Recommended for properties >20 units',
      },
    ];

    return coverages;
  },

  escalationRate(ctx: InsuranceContext): InsuranceEscalation {
    const coastal = isCoastalCounty(ctx);
    return {
      baseRate: coastal ? 0.050 : 0.035,
      rationale: coastal
        ? 'FL coastal markets are experiencing sustained insurance hardening (Cat-risk repricing, reinsurance costs, Citizens depopulation)'
        : 'FL inland markets: moderating from 2022-23 hardening peak; long-run expectation 3-4%/yr',
      recentTrend: coastal
        ? 'Miami-Dade/Broward: +18-25% YoY in 2023; moderating to +8-12% in 2024'
        : 'FL inland: +10-15% in 2022-23; stabilizing 2024',
    };
  },

  requiresInputs(): string[] {
    return ['units', 'county', 'isCoastal', 'floodZone', 'yearBuilt', 'constructionType'];
  },

  dataSourceHints(): string[] {
    return [
      'Citizens Property Insurance Corp: https://www.citizensfla.com/',
      'FL OIR Rate Comparison: https://apps.fldfs.com/ExPert/Home/Index',
      'FEMA Flood Zone Maps: https://msc.fema.gov/',
    ];
  },
};
