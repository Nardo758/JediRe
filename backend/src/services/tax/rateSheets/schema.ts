/**
 * Tax Service — Rate Sheet Schema & Zod Validator
 *
 * RateSheet: versioned JSON format for jurisdiction-specific tax rates.
 * One file per jurisdiction-year, loaded at boot by loader.ts.
 *
 * Three-layer separation: rates in JSON (this), mechanics in TypeScript (rulesets),
 * per-deal data from runtime fetch (PropertyAppraiserFetcher). Never mix layers.
 *
 * File naming: {jurisdiction}-{year}.json
 * Examples: federal-2026.json, fl-2026.json, fl-miami-dade-2026.json
 */

import { z } from 'zod';

// ── Source citations ──────────────────────────────────────────────────────────

export const SourceCitationSchema = z.object({
  field: z.string(),
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
  document_title: z.string().optional(),
});

export type SourceCitation = z.infer<typeof SourceCitationSchema>;

// ── Bonus depreciation entry ──────────────────────────────────────────────────

export const BonusDepreciationEntrySchema = z.object({
  year: z.number().int().min(2020).max(2035),
  pct: z.number().min(0).max(1),
});

// ── Depreciation lives ────────────────────────────────────────────────────────

export const DepreciationLivesSchema = z.object({
  multifamily: z.number().positive(),
  sfr: z.number().positive(),
  retail: z.number().positive(),
  office: z.number().positive(),
  industrial: z.number().positive(),
  hospitality: z.number().positive(),
}).partial();

// ── Millage breakdown ────────────────────────────────────────────────────────

export const MillageLineSchema = z.object({
  authority: z.string(),
  rate: z.number().nonnegative(),
  applies_to: z.enum(['all', 'homestead', 'non_homestead']).optional(),
});

export const MillageSchema = z.object({
  aggregate: z.number().nonnegative().optional(),
  breakdown: z.array(MillageLineSchema).optional(),
});

// ── TPP config ───────────────────────────────────────────────────────────────

export const TppSchema = z.object({
  taxed: z.boolean(),
  millage: z.union([z.number().nonnegative(), z.literal('same_as_re')]).optional(),
  exemption_amount: z.number().nonnegative().optional(),
  filing_form: z.string().optional(),
  filing_deadline: z.string().optional(),
  name: z.string().optional(),
  depreciation_schedule: z.object({
    years: z.number().int().positive(),
    residual_pct: z.number().min(0).max(1),
    annual_rate_pct: z.number().min(0).max(1),
  }).optional(),
});

// ── Transfer tax config ───────────────────────────────────────────────────────

export const TransferTaxSchema = z.object({
  deed_rate_per_100: z.number().nonnegative().optional(),
  deed_rate_per_1000: z.number().nonnegative().optional(),
  intangible_rate_per_100: z.number().nonnegative().optional(),
  mortgage_stamp_rate_per_100: z.number().nonnegative().optional(),
  recording_fee_per_page: z.number().nonnegative().optional(),
});

// ── County surtax config ──────────────────────────────────────────────────────

export const CountySurtaxSchema = z.object({
  rate_per_100: z.number().nonnegative(),
  applies_to: z.enum(['all', 'non_homestead', 'commercial']),
});

// ── State income tax brackets ─────────────────────────────────────────────────

export const StateIncomeTaxRateSchema = z.object({
  entity_type: z.enum(['individual', 'pass_through', 'c_corp', 'reit', 'partnership']),
  rate: z.number().min(0).max(1),
});

// ── Federal income tax brackets ───────────────────────────────────────────────

export const FederalTaxBracketSchema = z.object({
  min_income: z.number().nonnegative(),
  max_income: z.number().nonnegative().nullable(),
  entity_type: z.enum(['individual', 'pass_through', 'c_corp', 'reit', 'partnership']),
  rate: z.number().min(0).max(1),
});

// ── Full rate sheet ───────────────────────────────────────────────────────────

export const RateSheetSchema = z.object({
  jurisdiction: z.string(),
  level: z.enum(['federal', 'state', 'county']),
  year: z.number().int().min(2020).max(2040),
  version: z.string(),
  as_of: z.string().datetime(),
  valid_through: z.string().datetime(),
  source_citations: z.array(SourceCitationSchema).default([]),

  // Section A
  millage: MillageSchema.optional(),
  assessment_ratio: z.number().min(0).max(1).optional(),
  exemption_dollar_amounts: z.record(z.string(), z.number().nonnegative()).optional(),

  // Section B
  tpp: TppSchema.optional(),

  // Section C (federal sheet)
  bonus_depreciation: z.array(BonusDepreciationEntrySchema).optional(),
  depreciation_lives: DepreciationLivesSchema.optional(),
  federal_income_tax_brackets: z.array(FederalTaxBracketSchema).optional(),
  // Section C (state sheets)
  state_income_tax_rate: z.array(StateIncomeTaxRateSchema).optional(),
  conforms_to_bonus_dep: z.boolean().optional(),
  conforms_to_cost_seg: z.boolean().optional(),

  // Section D
  transfer_tax: TransferTaxSchema.optional(),
  county_surtax: CountySurtaxSchema.optional(),
});

export type RateSheet = z.infer<typeof RateSheetSchema>;

/**
 * Validate a raw JSON object as a RateSheet.
 * Throws a descriptive ZodError on validation failure (fail-loud per spec).
 */
export function validateRateSheet(raw: unknown, filename?: string): RateSheet {
  const result = RateSheetSchema.safeParse(raw);
  if (!result.success) {
    const prefix = filename ? `[RateSheet: ${filename}] ` : '[RateSheet] ';
    const message = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`${prefix}Validation failed:\n${message}`);
  }
  return result.data;
}
