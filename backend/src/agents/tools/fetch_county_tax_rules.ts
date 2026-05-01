/**
 * Tool: fetch_county_tax_rules
 *
 * Returns the assessment methodology a county uses for property tax:
 * assessment ratio, reassessment cycle, cap structure, millage rates,
 * exemptions, special districts, and abatement programs.
 *
 * Unlike fetch_tax_intel (which returns computed tax amounts for a deal),
 * this tool returns the RULES themselves — so the agent can reason about
 * forward-year projections and understand the methodology.
 *
 * Phase B5 — M36_PROFORMA_LINE_ITEM_ANCHORS.md
 */

import { z } from 'zod';
import { taxService } from '../../services/tax/taxService';
import type { TaxRuleset } from '../../services/tax/types';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

// ─── Input Schema ───────────────────────────────────────────────────────────

const InputSchema = z.object({
  state: z.string().describe('Two-letter state code (GA, FL, TX, CA, NY, IL, NC, LA, AZ)'),
  county: z.string().optional().describe('County name for millage rate lookup (e.g., Fulton, Miami-Dade)'),
});

// ─── Output Types ───────────────────────────────────────────────────────────

interface CountyTaxMethodology {
  state: string;
  methodology: {
    assessmentRatio: number;
    assessmentRatioDescription: string;
    reassessmentOnSale: 'full' | 'capped' | 'none';
    reassessmentCycleDescription: string;
    annualAssessmentCap: number | null;
    annualAssessmentCapDescription: string;
    annualGrowthTrend: number;
    transferTax: {
      rate: number;
      description: string;
    };
    millageRate: number | null;
    millageRateSource: string;
  };
  exemptions: Array<{
    name: string;
    description: string;
    applicableToCommercial: boolean;
  }>;
  specialTaxes: Array<{
    name: string;
    description: string;
    rate: number;
  }>;
  abatementPrograms: Array<{
    name: string;
    description: string;
  }>;
  dataSources: string[];
  proformaGuidance: {
    year1Base: string;
    forwardProjection: string;
    agentPrompting: string;
  };
}

// ─── Methodology Map (hardcoded — matches tax rulesets) ──────────────────

/**
 * Assessment methodology per state. Extracted from tax rulesets to provide
 * the agent with the reasoning context, not just computed numbers.
 */
const STATE_METHODOLOGIES: Record<string, {
  assessmentRatio: number;
  assessmentRatioDesc: string;
  reassessment: 'full' | 'capped' | 'none';
  cycleDesc: string;
  cap: number | null;
  capDesc: string;
  annualTrend: number;
  transferRate: number;
  transferDesc: string;
  probes: string;
}> = {
  GA: {
    assessmentRatio: 0.40,
    assessmentRatioDesc: 'GA assesses commercial property at 40% of fair market value. Millage is applied to this assessed value. Effective tax rate = millage × 0.40.',
    reassessment: 'full',
    cycleDesc: 'Full reassessment on sale (acquisition triggers new assessment at purchase price). Annual reassessment for existing owners with no cap on commercial.',
    cap: null,
    capDesc: 'No annual assessment cap for commercial property. Residential homestead has a cap but does not apply to multifamily.',
    annualTrend: 0.04,
    transferRate: 0.001,
    transferDesc: '$1.00 per $1,000 of purchase price (0.1%). No intangible tax on mortgages.',
    probes: 'GA 40% assessment ratio is the most common trap — agents often apply millage directly to purchase price, overestimating taxes by 2.5x. The taxService applies millage to the FULL purchase price as a workaround (equivalent to 40% × 2.5× millage). Verify county-specific millage via county tax assessor website. Fulton County uses qpublic.net.',
  },
  FL: {
    assessmentRatio: 1.0,
    assessmentRatioDesc: 'Florida assesses commercial property at just/market value (100% of FMV). No fractional assessment like GA.',
    reassessment: 'full',
    cycleDesc: 'Full reassessment on sale (acquisition triggers new assessment at purchase price). Annual reassessment for existing owners.',
    cap: 0.10,
    capDesc: 'Non-homestead assessment cap: annual increase capped at 10% for commercial/non-homestead property. Save Our Homes (SOH) 3% cap applies only to homesteaded residential — NOT to multifamily investments. However, a property with active SOH cap from prior owner will lose it on sale.',
    annualTrend: 0.03,
    transferRate: 0.007, // approximate — varies by county (statewide surtax)
    transferDesc: 'State documentary stamp tax: $0.70 per $100 ($7 per $1,000) on deeds. Miami-Dade adds county surtax. Intangible tax on new mortgage recordings.',
    probes: 'FL non-homestead 10% cap is for annual assessment increases, NOT for reassessment on sale. When you buy, the property resets to purchase price. The cap only limits future growth. Miami-Dade has higher millage rates and an additional county surtax. Always check if property had SOH cap (residential → will lose on sale).',
  },
  TX: {
    assessmentRatio: 1.0,
    assessmentRatioDesc: 'Texas assesses at 100% of market value. No fractional assessment.',
    reassessment: 'full',
    cycleDesc: 'Full reassessment on sale. Annual reappraisal by county appraisal district.',
    cap: 0.10,
    capDesc: 'Residential homestead cap: 10% annual increase on appraised value for homesteaded properties ONLY. Commercial/multifamily properties DO NOT have a cap — full market value reappraisal each year.',
    annualTrend: 0.035,
    transferRate: 0.0,
    transferDesc: 'No deed transfer tax in Texas. No state income tax. No intangible tax.',
    probes: 'TX has no state income tax but has higher millage rates to compensate. Commercial properties pay the full rate with no cap. School district taxes (often separate line) can be significant. Counties have appraisal districts (e.g., CADs) that set values independently.',
  },
  CA: {
    assessmentRatio: 1.0,
    assessmentRatioDesc: 'California assesses at 1.0 (100% of full cash value / fair market value).',
    reassessment: 'capped',
    cycleDesc: 'Prop 13: base year value established at acquisition. Annual increases capped at 2% regardless of market value changes. Full reassessment ONLY on sale or new construction. No annual reassessment for existing owners.',
    cap: 0.02,
    capDesc: 'Prop 13: annual assessment increase capped at 2% of prior assessed value (not market value). The property only reassesses to market value on sale or new construction. This means long-held properties can be taxed at a fraction of market value.',
    annualTrend: 0.02,
    transferRate: 0.0011,
    transferDesc: 'Documentary transfer tax: typically $1.10 per $1,000 ($0.55 state + $0.55 county). Some cities (LA, San Francisco) add additional city transfer taxes.',
    probes: 'Prop 13 is the biggest tax consideration in CA. The tax bill on an existing property you buy will be MUCH higher than what the current owner pays (due to 2% cap since purchase). Always model post-acquisition reassessment to purchase price. Some counties have parcel taxes that are additional fixed amounts.',
  },
  NY: {
    assessmentRatio: 1.0,
    assessmentRatioDesc: 'NY assesses based on a uniform percentage of market value set by each assessing unit (county/city). For NYC: assessed at ~45% of market value for commercial. State law requires uniform within each assessing unit.',
    reassessment: 'full',
    cycleDesc: 'NY has a 1-year lag: assessment reflects prior year value. Reassessment on sale is full. Assessment rolls are established on January 1 each year.',
    cap: null,
    capDesc: 'No statutory assessment cap for commercial property in NY. Rent-stabilized properties may have income-based valuation approaches.',
    annualTrend: 0.04,
    transferRate: 0.004,
    transferDesc: 'NY transfer tax: $2 per $500 ($4 per $1,000) state, plus county/city surcharges. NYC adds ~1.425% mansion tax on properties over $1M. Mortgage recording tax applies.',
    probes: 'NY is complex due to the 1-year valuation lag and multiple overlapping tax jurisdictions. NYC has a different assessment method (income capitalization for commercial/rental). Upstate NY uses market value. Check whether the property is subject to any Payment in Lieu of Taxes (PILOT) agreements.',
  },
  IL: {
    assessmentRatio: 0.3333,
    assessmentRatioDesc: 'Illinois assesses commercial property at 33.33% of market value. Residential is 10% of market value. Farm is 33.33% of agricultural use value. The multiplier (equalization factor) is applied by county.',
    reassessment: 'full',
    cycleDesc: 'Illinois uses triennial reassessment: each county reassesses one-third of properties each year (3-year cycle). Cook County has a different cycle. Sale triggers review but not immediate full reassessment.',
    cap: 0.05,
    capDesc: 'Tax caps vary by county: Cook County has 5% cap on assessment increases for non-homestead property. Other counties may have no cap. Assessment increases are phased in over 3 years for commercial properties experiencing large jumps.',
    annualTrend: 0.03,
    transferRate: 0.0,
    transferDesc: 'Illinois has a state transfer tax but no deed transfer tax rate — counties/cities handle separately. Cook County adds ~$0.50 per $500 ($1 per $1,000) RE transfer tax.',
    probes: 'IL triennial assessment cycle means taxes can jump significantly when a property comes up for reassessment after 3 years. The 5% Cook County cap is per reassessment event, not per year. Always check whether the property is in a Tax Increment Finance (TIF) district.',
  },
  NC: {
    assessmentRatio: 1.0,
    assessmentRatioDesc: 'North Carolina assesses at 100% of market value. Use value for agricultural/horticultural.',
    reassessment: 'full',
    cycleDesc: 'County-wide reassessment every 8 years (varies by county — some do 4 years). Sale triggers review but reassessment typically follows the county cycle.',
    cap: null,
    capDesc: 'NC has no statutory assessment cap for commercial property. Counties use their scheduled reassessment cycle to update values.',
    annualTrend: 0.03,
    transferRate: 0.001,
    transferDesc: 'NC deed transfer tax: $1 per $500 ($2 per $1,000) on deeds of trust. No state transfer tax on real estate transfers themselves.',
    probes: 'NC\'s 8-year reassessment cycle means large jumps when reassessment occurs. The assessor reviews all properties in the county on schedule. Sale can trigger a review, but the major adjustment comes at the county cycle.',
  },
  LA: {
    assessmentRatio: 0.10,
    assessmentRatioDesc: 'Louisiana assesses at 10% of fair market value for residential/commercial. 15% for public service properties (utilities). Agricultural/forestry land uses use value.',
    reassessment: 'full',
    cycleDesc: 'Quadrennial (4-year) reassessment cycle. Each parish conducts full reappraisal every 4 years. Sale triggers review for assessment at new value.',
    cap: null,
    capDesc: 'No annual assessment cap for commercial property. Residential homestead has a $75,000 exemption.',
    annualTrend: 0.035,
    transferRate: 0.0,
    transferDesc: 'No state deed transfer tax in Louisiana. Some parishes impose a small tax on property transfers (varies by parish).',
    probes: 'LA\'s 10% assessment ratio means effective tax rates are very low compared to face millage rates. The quadrennial cycle creates large jumps on reassessment years. Oil/gas properties have different valuation methods.',
  },
  AZ: {
    assessmentRatio: 0.18,
    assessmentRatioDesc: 'Arizona assesses commercial/rental property at 18% of full cash value. Owner-occupied residential at 10%. Agricultural at 16.67%.',
    reassessment: 'full',
    cycleDesc: 'Annual reassessment by county assessor. State law requires all property be valued annually. Sale triggers full reassessment.',
    cap: 0.05,
    capDesc: 'Annual assessment cap: 5% increase for commercial/rental properties. Owner-occupied has 5% cap. The cap limits the increase in assessed value, not the tax amount — tax rate changes can still increase the bill.',
    annualTrend: 0.03,
    transferRate: 0.0,
    transferDesc: 'No state deed transfer tax in Arizona. No state income tax on RE gains (but federal applies).',
    probes: 'AZ 5% cap limits assessment growth but does not cap the tax levy — if the tax rate increases or voters approve bonds, the actual tax bill can exceed 5%. The 18% assessment ratio applies to FULL cash value, not fractional. Verify county-specific equalization factors.',
  },
};

// ─── Millage Rate Map (from tax rulesets) ──────────────────────────────────

const MILLAGE_RATES: Record<string, Record<string, number> | undefined> = {
  GA: {
    'fulton': 11.60,
    'dekalb': 13.20,
    'gwinnett': 10.80,
    'cobb': 10.00,
    'clayton': 13.00,
    'cherokee': 9.20,
  },
  FL: {
    'miami-dade': 23.09,
    'broward': 20.50,
    'orange': 21.00,
    'hillsborough': 19.50,
  },
  TX: {
    'harris': 28.50,
    'dallas': 27.80,
    'tarrant': 26.50,
    'bexar': 27.00,
    'travis': 26.00,
  },
};

const DEFAULT_MILLAGE: Record<string, number> = {
  GA: 10.80,
  FL: 20.00,
  TX: 27.50,
  CA: 10.00,
  NY: 12.00,
  IL: 8.50,
  NC: 7.00,
  LA: 12.00,
  AZ: 12.50,
};

// ─── Execution ──────────────────────────────────────────────────────────────

async function fetchCountyTaxRules(input: unknown): Promise<CountyTaxMethodology> {
  const parsed = InputSchema.parse(input);
  const stateCode = parsed.state.toUpperCase();
  const county = parsed.county?.toLowerCase().trim() ?? '';

  const methodology = STATE_METHODOLOGIES[stateCode];
  if (!methodology) {
    throw new Error(`Unknown state: ${stateCode}. Supported: ${Object.keys(STATE_METHODOLOGIES).join(', ')}`);
  }

  // Resolve millage
  const countyRates = MILLAGE_RATES[stateCode];
  const millageRate = county && countyRates?.[county] ?? DEFAULT_MILLAGE[stateCode] ?? null;
  const millageSource = county && countyRates?.[county]
    ? `County-specific: ${county}, ${stateCode}`
    : `Default for ${stateCode}`;

  // Try to get exemptions from rulesets
  let exemptions: CountyTaxMethodology['exemptions'] = [];
  let specialTaxes: CountyTaxMethodology['specialTaxes'] = [];
  let abatementPrograms: CountyTaxMethodology['abatementPrograms'] = [];
  let dataSources: string[] = [];

  try {
    const ctx = { state: stateCode, county: parsed.county || '', purchasePrice: 10000000, totalUnits: 100, vintage: 1980 } as any;
    const service = taxService as any;
    const ruleset: TaxRuleset | undefined = service.registry?.[stateCode];

    if (ruleset) {
      exemptions = ruleset.abatementEligibility?.(ctx)?.map(a => ({
        name: a.name,
        description: a.description,
        applicableToCommercial: a.name.toLowerCase().includes('commercial') ||
          a.name.toLowerCase().includes('freeport') ||
          !a.name.toLowerCase().includes('homestead'),
      })) ?? [];

      specialTaxes = (ruleset.specialTaxes?.(ctx) as any[])?.map((t: any) => ({
        name: t.name,
        description: t.description,
        rate: t.rate ?? 0,
      })) ?? [];

      abatementPrograms = ruleset.abatementEligibility?.(ctx)?.map(a => ({
        name: a.name,
        description: a.description,
      })) ?? [];

      dataSources = ruleset.dataSourceHints?.() ?? [];
    }
  } catch (err: any) {
    logger.warn(`[county-tax-rules] Ruleset lookup failed for ${stateCode}: ${err.message}`);
  }

  // Guidance for the agent
  const year1Base = `Year 1 tax = assessedValue × (${millageRate ?? '??'} mills / 1000). ` +
    `Assessment ratio: ${(methodology.assessmentRatio * 100).toFixed(0)}%. ` +
    `On acquisition, assessed value resets to ${methodology.reassessment === 'none' ? 'prior value (no change)' : 'purchase price'}.`;

  const forwardProjection = `Year 2+ taxes = prior assessed value × (1 + ${(methodology.annualTrend * 100).toFixed(1)}% trend) × millage. ` +
    (methodology.cap
      ? `Assessment increase capped at ${(methodology.cap * 100).toFixed(0)}% per year. Cap binds if growth exceeds ${(methodology.cap * 100).toFixed(0)}%.`
      : 'No assessment cap — use market trend for forward projections.') +
    ` ${methodology.cycleDesc}`;

  const agentPrompting = methodology.probes;

  return {
    state: stateCode,
    methodology: {
      assessmentRatio: methodology.assessmentRatio,
      assessmentRatioDescription: methodology.assessmentRatioDesc,
      reassessmentOnSale: methodology.reassessment,
      reassessmentCycleDescription: methodology.cycleDesc,
      annualAssessmentCap: methodology.cap,
      annualAssessmentCapDescription: methodology.capDesc,
      annualGrowthTrend: methodology.annualTrend,
      transferTax: {
        rate: methodology.transferRate,
        description: methodology.transferDesc,
      },
      millageRate,
      millageRateSource: millageSource,
    },
    exemptions,
    specialTaxes,
    abatementPrograms,
    dataSources,
    proformaGuidance: {
      year1Base,
      forwardProjection,
      agentPrompting,
    },
  };
}

// ─── Tool Export ─────────────────────────────────────────────────────────────

export const fetchCountyTaxRulesTool: ToolDefinition<unknown, unknown> = {
  name: 'fetch_county_tax_rules',
  description: `Retrieve the property tax assessment methodology for a county.

Returns structured data about HOW property taxes are calculated in the
jurisdiction — assessment ratio, reassessment cycle, cap structure, millage
rates, exemptions, special taxes, and abatement programs.

Use this tool when you need to:
- Understand how the county assesses commercial property
- Determine whether the annual assessment cap applies
- Figure out forward-year tax projections after reassessment
- Check if exemptions or abatements are available
- Verify the millage rate for a specific county

Unlike fetch_tax_intel (which computes actual tax amounts for a deal),
this tool returns the methodology itself. Use both:
1. fetch_county_tax_rules → understand the rules
2. fetch_tax_intel → get computed amounts for the specific deal

Known jurisdictions: GA, FL, TX, CA, NY, IL, NC, LA, AZ`,
  inputSchema: InputSchema,
  outputSchema: z.unknown(),
  requiresCapability: 'read:financial',
  execute: fetchCountyTaxRules,
};

export default fetchCountyTaxRulesTool;

