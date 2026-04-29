/**
 * fetch_tax_intel — Agent tool for property tax calculations
 *
 * Agents call this when they need to figure out property taxes for a deal.
 * Uses the existing taxService engine (jurisdiction rulesets) plus the
 * property_info_cache for parcel-level millage rates.
 *
 * Key GA specifics:
 * - GA assesses at 40% of fair market value
 * - Millage is applied to full purchase price (equivalent to 40% × 2.5× millage)
 * - Transfer tax: $1 per $1,000 of purchase price (0.1%)
 * - No assessment cap for commercial property
 * - Acquisition triggers full reassessment
 *
 * Returns structured tax data the agent can fold into proforma_fields.
 */

import { z } from 'zod';
import type { Pool } from 'pg';
import { getPool } from '../../database/connection';
import { taxService } from '../../services/tax/taxService';
import type { TaxContext } from '../../services/tax/taxService';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';


const InputSchema = z.object({
  dealId: z.string().uuid(),
  state: z.string().optional().default(''),
  county: z.string().nullable().optional().default(null),
  city: z.string().nullable().optional().default(null),
  purchasePrice: z.number().nullable().optional().default(null),
  loanAmount: z.number().nullable().optional().default(null),
  units: z.number().optional().default(0),
  t12AnnualTax: z.number().nullable().optional().default(null),
  holdYears: z.number().optional().default(10),
  isRefi: z.boolean().optional().default(false),
});

type FetchTaxIntelParams = z.infer<typeof InputSchema>;



interface TaxIntelResult {
  jurisdiction: string;
  rulesetUsed: string;
  reTax: {
    t12AssessedValue: number | null;
    t12MillageRate: number | null;
    t12AnnualTax: number | null;
    platformAssessedValue: number | null;
    platformAnnualTax: number | null;
    sohCapPct: number;
    year1: {
      year: number;
      assessedValue: number;
      millageRate: number;
      taxAmount: number;
      reassessmentEvent: boolean;
      sohCapBinding: boolean;
    };
    deltaVsT12Pct: number | null;
    summary: string;
  };
  transferTax: {
    totalTransferTax: number | null;
    docStampAmount: number | null;
    appliedRatePct: number;
    refiTotalTax: number | null;
  };
  tips: string[];
}

export const fetchTaxIntelTool: ToolDefinition<
  FetchTaxIntelParams,
  unknown
> = {
  name: 'fetch_tax_intel',
  description: `Calculate property tax math for a deal using jurisdiction-specific rulesets.

Use this tool when you need to:
- Figure out annual property tax for an acquisition or development
- Calculate transfer taxes (doc stamps, deed recording)
- Compare post-acquisition tax vs T12 taxes
- Determine tax consequences of development vs acquisition
- Check for abatement programs or special tax districts

The tool uses the platform's tax engine which knows:
- GA: 40% assessment ratio, millage rates by county, $1/$1K transfer tax
- FL: Save Our Homes cap, Miami-Dade surtax, intangible tax
- TX: No state income tax, local school district taxes
- Default: generic millage fallback for unknown jurisdictions

Returns structured tax data with year-1 assessment, millage, and tax amount.`,
  inputSchema: InputSchema,
  outputSchema: z.unknown(),
  requiresCapability: 'read:financial',
  execute: async (params: FetchTaxIntelParams, _ctx) => {
    return fetchTaxIntelImpl(params);
  },
};

async function fetchTaxIntelImpl(
  params: FetchTaxIntelParams,
  pool?: Pool
): Promise<TaxIntelResult> {
  const db = pool ?? getPool();

  logger.info(`[fetch_tax_intel] Called for deal ${params.dealId}`);

  // Try to enrich county from property_info_cache if not provided
  let county = params.county;
  let enrichedCounty = false;
  if (!county && params.dealId) {
    try {
      const { rows } = await db.query(
        `SELECT pic.county
         FROM deals d
         LEFT JOIN property_info_cache pic ON LOWER(pic.address) = LOWER(SPLIT_PART(d.address, ',', 1))
         WHERE d.id = $1
         LIMIT 1`,
        [params.dealId]
      );
      if (rows[0]?.county) {
        county = rows[0].county;
        enrichedCounty = true;
      }
    } catch { /* non-fatal */ }
  }

  // Build tax context
  const ctx: TaxContext = {
    state: params.state || 'GA',
    county,
    city: params.city,
    purchasePrice: params.purchasePrice,
    loanAmount: params.loanAmount,
    assessedValueOverride: null,
    millageRateOverride: null,
    countyOverride: null,
    units: params.units,
    t12AnnualTax: params.t12AnnualTax,
    holdYears: params.holdYears,
    isRefi: params.isRefi,
    refiEnabled: false,
    refiTriggerYear: 5,
    refiNewLoanType: null,
  };

  // Run forecast
  const forecast = taxService.forecast(ctx);
  const y1 = forecast.reTax.perYear[0];

  // Build human-readable summary
  const parts: string[] = [];
  parts.push(`Jurisdiction: ${forecast.jurisdiction} (ruleset: ${forecast.rulesetUsed})`);

  if (params.t12AnnualTax) {
    parts.push(`T12 annual tax: $${params.t12AnnualTax.toLocaleString()}`);
    if (forecast.reTax.t12MillageRate) {
      parts.push(`Implied T12 millage: ${forecast.reTax.t12MillageRate.toFixed(2)} mills on FMV`);
    }
  }

  if (forecast.reTax.t12AssessedValue) {
    parts.push(`Implied T12 assessed value: $${forecast.reTax.t12AssessedValue.toLocaleString()}`);
  }

  parts.push(`Year 1 assessed value: $${y1.assessedValue.toLocaleString()}`);
  parts.push(`Year 1 millage rate: ${y1.millageRate.toFixed(2)} mills on FMV`);
  parts.push(`Year 1 annual tax: $${y1.taxAmount.toLocaleString()}`);

  if (forecast.reTax.deltaVsT12Pct != null) {
    const sign = forecast.reTax.deltaVsT12Pct >= 0 ? '+' : '';
    parts.push(`Delta vs T12: ${sign}${(forecast.reTax.deltaVsT12Pct * 100).toFixed(1)}%`);
    if (Math.abs(forecast.reTax.deltaVsT12Pct) > 0.15) {
      parts.push(`⚠ Large delta (>15%) — likely post-acquisition reassessment effect`);
    }
  }

  parts.push(`Transfer tax (doc stamps): $${(forecast.transferTax.totalTransferTax ?? 0).toLocaleString()}`);

  // Special taxes
  for (const st of forecast.specialTaxes) {
    parts.push(`Special tax: ${st.name} — $${st.amount.toLocaleString()} (${st.trigger})`);
  }

  // Abatement opportunities
  for (const ab of forecast.abatementPrograms) {
    parts.push(`Abatement opportunity: ${ab.name} — ${ab.description}`);
  }

  // Development vs acquisition tip
  const tips: string[] = [];
  if (forecast.rulesetUsed === 'GA') {
    tips.push('GA assesses at 40% of fair market value. Millage is on FMV, not 40%.');
    tips.push('Acquisition triggers full reassessment to purchase price.');
    tips.push('For development: vacant land typically taxed at lower rate until CO is issued.');
    tips.push('Transfer tax is $1.00 per $1,000 of purchase price (0.1%).');
  }

  return {
    jurisdiction: forecast.jurisdiction,
    rulesetUsed: forecast.rulesetUsed,
    reTax: {
      t12AssessedValue: forecast.reTax.t12AssessedValue,
      t12MillageRate: forecast.reTax.t12MillageRate,
      t12AnnualTax: forecast.reTax.t12AnnualTax,
      platformAssessedValue: forecast.reTax.platformAssessedValue,
      platformAnnualTax: forecast.reTax.platformAnnualTax,
      sohCapPct: forecast.reTax.sohCapPct,
      year1: {
        year: y1.year,
        assessedValue: y1.assessedValue,
        millageRate: y1.millageRate,
        taxAmount: y1.taxAmount,
        reassessmentEvent: y1.reassessmentEvent,
        sohCapBinding: y1.sohCapBinding,
      },
      deltaVsT12Pct: forecast.reTax.deltaVsT12Pct,
      summary: parts.join(' | '),
    },
    transferTax: {
      totalTransferTax: forecast.transferTax.totalTransferTax,
      docStampAmount: forecast.transferTax.docStampAmount,
      appliedRatePct: forecast.transferTax.appliedRatePct,
      refiTotalTax: forecast.transferTax.refi?.refiTotalTax ?? null,
    },
    tips,
  };
}
