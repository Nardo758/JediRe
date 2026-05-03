/**
 * Tool: fetch_line_item_benchmarks
 *
 * Returns P10-P90 per-unit and %EGI distributions for specific OpEx/revenue
 * line items, filtered by location, asset class, deal type, vintage, and size.
 *
 * The CashFlow Agent calls this for every line item it needs to underwrite,
 * using the distributions to:
 *   - Validate T-12 actuals against market norms
 *   - Flag outliers (< P10 or > P90)
 *   - Apply conservative defaults when T-12 is missing a line
 *   - Detect potential broker manipulation of specific expense lines
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const InputSchema = z.object({
  line_items: z.array(z.string()).describe(
    'List of line item names to fetch benchmarks for (e.g. ["payroll", "insurance", "real_estate_taxes"])'
  ),
  state: z.string().optional().describe('State code (e.g. "GA", "TX")'),
  msa: z.string().optional().describe('MSA name'),
  submarket: z.string().optional().describe('Submarket name'),
  asset_class: z.string().optional().describe('Asset class (A, B, C, D)'),
  deal_type: z.string().optional().describe('Deal type: existing | value-add | lease-up | development'),
  vintage_band: z.string().optional().describe('Vintage band: pre-1990 | 1990-2005 | 2006-2015 | 2016+'),
  unit_count_band: z.string().optional().describe('Size band: <100 | 100-200 | 200-350 | 350+'),
  include_trends: z.boolean().optional().default(false).describe('Include YoY growth trend data'),
  building_profile_fingerprint: z.string().optional().describe(
    'Building profile fingerprint for profile-matched benchmarks (e.g. "garden|2010-2019|elev|pool|fit|club"). ' +
    'When provided, returns additional per-unit benchmarks from properties with the same building profile.'
  ),
});

const ProfileBenchmarkSchema = z.object({
  line_item: z.string(),
  per_unit: z.object({
    p10: z.number().nullable(),
    p25: z.number().nullable(),
    p50: z.number().nullable(),
    p75: z.number().nullable(),
    p90: z.number().nullable(),
  }),
  pct_egi: z.object({
    p10: z.number().nullable(),
    p25: z.number().nullable(),
    p50: z.number().nullable(),
    p75: z.number().nullable(),
    p90: z.number().nullable(),
  }).nullable(),
  sample_count: z.number(),
});

const LineItemBenchmarkSchema = z.object({
  line_item: z.string(),
  category: z.string(),
  bucket_matched: z.record(z.string(), z.unknown()),
  per_unit: z.object({
    p10: z.number().nullable(),
    p25: z.number().nullable(),
    p50: z.number().nullable(),
    p75: z.number().nullable(),
    p90: z.number().nullable(),
    mean: z.number().nullable(),
  }),
  pct_egi: z.object({
    p10: z.number().nullable(),
    p25: z.number().nullable(),
    p50: z.number().nullable(),
    p75: z.number().nullable(),
    p90: z.number().nullable(),
  }).nullable(),
  yoy_growth: z.object({
    p10: z.number().nullable(),
    p50: z.number().nullable(),
    p90: z.number().nullable(),
  }).nullable(),
  n_samples: z.number(),
  n_deals: z.number(),
  as_of: z.string().nullable(),
});

const OutputSchema = z.object({
  found: z.boolean(),
  benchmarks: z.array(LineItemBenchmarkSchema),
  missing_line_items: z.array(z.string()),
  bucket_context: z.object({
    state: z.string().nullable(),
    msa: z.string().nullable(),
    asset_class: z.string().nullable(),
    deal_type: z.string().nullable(),
    vintage_band: z.string().nullable(),
    narrowest_match_level: z.string(),
  }),
  note: z.string().optional(),
  profile_match: z.object({
    found: z.boolean(),
    fingerprint: z.string().nullable(),
    benchmarks: z.array(ProfileBenchmarkSchema),
    region: z.string(),
  }).optional(),
});

export const fetchLineItemBenchmarksTool = {
  name: 'fetch_line_item_benchmarks',
  description:
    'Returns P10/P25/P50/P75/P90 per-unit distributions for specified OpEx and revenue line items. ' +
    'Filters by location (state/MSA/submarket), asset class, deal type, vintage, and size. ' +
    'Use to validate T-12 line items, flag outliers, and set conservative defaults. ' +
    'Returns both per-unit amounts and % of EGI where available.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  async execute(input: z.infer<typeof InputSchema>) {
    try {
      const { line_items, state, msa, submarket, asset_class, deal_type, vintage_band, unit_count_band, include_trends } = input;

      if (!line_items || line_items.length === 0) {
        return {
          found: false,
          benchmarks: [],
          missing_line_items: [],
          bucket_context: {
            state: null,
            msa: null,
            asset_class: null,
            deal_type: null,
            vintage_band: null,
            narrowest_match_level: 'none',
          },
          note: 'No line items specified',
          profile_match: input.building_profile_fingerprint ? {
            found: false,
            fingerprint: input.building_profile_fingerprint,
            benchmarks: [],
            region: 'national',
          } : undefined,
        };
      }

      // Normalize line item names (lowercase, underscores)
      const normalizedItems = line_items.map(item => 
        item.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
      );

      const benchmarks: z.infer<typeof LineItemBenchmarkSchema>[] = [];
      const foundItems = new Set<string>();
      let narrowestMatchLevel = 'national';

      // Try progressively broader buckets
      const bucketLevels = [
        { level: 'submarket', filters: { state, msa, submarket, asset_class, deal_type, vintage_band, unit_count_band } },
        { level: 'msa_class_vintage', filters: { state, msa, submarket: null, asset_class, deal_type, vintage_band, unit_count_band: null } },
        { level: 'msa_class', filters: { state, msa, submarket: null, asset_class, deal_type: null, vintage_band: null, unit_count_band: null } },
        { level: 'state_class', filters: { state, msa: null, submarket: null, asset_class, deal_type: null, vintage_band: null, unit_count_band: null } },
        { level: 'national_class', filters: { state: null, msa: null, submarket: null, asset_class, deal_type: null, vintage_band: null, unit_count_band: null } },
        { level: 'national', filters: { state: null, msa: null, submarket: null, asset_class: null, deal_type: null, vintage_band: null, unit_count_band: null } },
      ];

      for (const normalizedItem of normalizedItems) {
        if (foundItems.has(normalizedItem)) continue;

        for (const bucket of bucketLevels) {
          const params: unknown[] = [normalizedItem];
          // Cast $1 to text on the ANY() side so pg can resolve the
          // operator unambiguously against the line_item_aliases text[].
          const conditions: string[] = ['(line_item = $1 OR $1::text = ANY(line_item_aliases))'];
          let paramIdx = 1;

          // Build dynamic WHERE clause. Only consume a positional param when
          // we actually push a value, otherwise paramIdx drifts past params.length.
          const addCondition = (field: string, value: string | null | undefined) => {
            if (value) {
              paramIdx++;
              conditions.push(`${field} = $${paramIdx}`);
              params.push(value);
            } else {
              conditions.push(`${field} IS NULL`);
            }
          };

          addCondition('state', bucket.filters.state);
          addCondition('msa', bucket.filters.msa);
          addCondition('submarket', bucket.filters.submarket);
          addCondition('asset_class', bucket.filters.asset_class);
          addCondition('deal_type', bucket.filters.deal_type);
          addCondition('vintage_band', bucket.filters.vintage_band);
          addCondition('unit_count_band', bucket.filters.unit_count_band);

          const result = await query(
            `SELECT 
              line_item, category,
              per_unit_p10, per_unit_p25, per_unit_p50, per_unit_p75, per_unit_p90, per_unit_mean,
              pct_egi_p10, pct_egi_p25, pct_egi_p50, pct_egi_p75, pct_egi_p90,
              yoy_growth_p10, yoy_growth_p50, yoy_growth_p90,
              n_samples, n_deals, as_of,
              state, msa, submarket, asset_class, deal_type, vintage_band, unit_count_band
            FROM line_item_benchmarks
            WHERE ${conditions.join(' AND ')}
              AND n_samples >= 3
            ORDER BY n_samples DESC, as_of DESC
            LIMIT 1`,
            params
          );

          if (result.rows.length > 0) {
            const row = result.rows[0] as Record<string, unknown>;
            foundItems.add(normalizedItem);
            
            if (bucket.level !== 'national' && narrowestMatchLevel === 'national') {
              narrowestMatchLevel = bucket.level;
            }

            benchmarks.push({
              line_item: String(row.line_item),
              category: String(row.category),
              bucket_matched: {
                state: row.state,
                msa: row.msa,
                submarket: row.submarket,
                asset_class: row.asset_class,
                deal_type: row.deal_type,
                vintage_band: row.vintage_band,
                unit_count_band: row.unit_count_band,
                match_level: bucket.level,
              },
              per_unit: {
                p10: row.per_unit_p10 != null ? Number(row.per_unit_p10) : null,
                p25: row.per_unit_p25 != null ? Number(row.per_unit_p25) : null,
                p50: row.per_unit_p50 != null ? Number(row.per_unit_p50) : null,
                p75: row.per_unit_p75 != null ? Number(row.per_unit_p75) : null,
                p90: row.per_unit_p90 != null ? Number(row.per_unit_p90) : null,
                mean: row.per_unit_mean != null ? Number(row.per_unit_mean) : null,
              },
              pct_egi: row.pct_egi_p50 != null ? {
                p10: row.pct_egi_p10 != null ? Number(row.pct_egi_p10) : null,
                p25: row.pct_egi_p25 != null ? Number(row.pct_egi_p25) : null,
                p50: row.pct_egi_p50 != null ? Number(row.pct_egi_p50) : null,
                p75: row.pct_egi_p75 != null ? Number(row.pct_egi_p75) : null,
                p90: row.pct_egi_p90 != null ? Number(row.pct_egi_p90) : null,
              } : null,
              yoy_growth: include_trends && row.yoy_growth_p50 != null ? {
                p10: row.yoy_growth_p10 != null ? Number(row.yoy_growth_p10) : null,
                p50: row.yoy_growth_p50 != null ? Number(row.yoy_growth_p50) : null,
                p90: row.yoy_growth_p90 != null ? Number(row.yoy_growth_p90) : null,
              } : null,
              n_samples: Number(row.n_samples),
              n_deals: Number(row.n_deals),
              as_of: row.as_of ? String(row.as_of) : null,
            });

            break; // Found benchmark for this line item, move to next
          }
        }
      }

      // Check for standard line item defaults if still missing
      const missingItems = normalizedItems.filter(item => !foundItems.has(item));
      
      if (missingItems.length > 0) {
        const defaultsResult = await query(
          `SELECT line_item, category, display_name, typical_range_low, typical_range_high
           FROM standard_line_items
           WHERE line_item = ANY($1::text[]) OR EXISTS (
             SELECT 1 FROM unnest(aliases) AS alias WHERE alias = ANY($1::text[])
           )`,
          [missingItems]
        );

        for (const row of defaultsResult.rows as Record<string, unknown>[]) {
          const lineItem = String(row.line_item);
          if (!foundItems.has(lineItem)) {
            foundItems.add(lineItem);
            // Use typical range as rough P25-P75
            const low = Number(row.typical_range_low ?? 0);
            const high = Number(row.typical_range_high ?? 0);
            const mid = (low + high) / 2;

            benchmarks.push({
              line_item: lineItem,
              category: String(row.category),
              bucket_matched: { match_level: 'default_range', source: 'standard_line_items' },
              per_unit: {
                p10: low * 0.8,
                p25: low,
                p50: mid,
                p75: high,
                p90: high * 1.2,
                mean: mid,
              },
              pct_egi: null,
              yoy_growth: null,
              n_samples: 0,
              n_deals: 0,
              as_of: null,
            });
          }
        }
      }

      // ── Profile-matched benchmarks (NEW) ─────────────────────────────────
      let profileBenchmarks: z.infer<typeof ProfileBenchmarkSchema>[] = [];
      let profileFound = false;
      
      if (input.building_profile_fingerprint) {
        try {
          // Cast $2 to text[] explicitly so a NULL value (when no line items
          // were normalised) doesn't trigger a "could not determine data type
          // of parameter" error from the planner.
          const result = await query(
            `SELECT line_item,
                    p10_per_unit, p25_per_unit, p50_per_unit, p75_per_unit, p90_per_unit,
                    p10_pct_egi, p25_pct_egi, p50_pct_egi, p75_pct_egi, p90_pct_egi,
                    sample_count
             FROM building_profile_opex_benchmarks
             WHERE profile_fingerprint = $1
               AND region = 'national'
               AND ($2::text[] IS NULL OR line_item = ANY($2::text[]))
             ORDER BY line_item`,
            [input.building_profile_fingerprint, normalizedItems.length > 0 ? normalizedItems : null]
          );
          
          profileBenchmarks = (result.rows as Record<string, unknown>[]).map(row => ({
            line_item: String(row.line_item),
            per_unit: {
              p10: Number(row.p10_per_unit ?? null),
              p25: Number(row.p25_per_unit ?? null),
              p50: Number(row.p50_per_unit ?? null),
              p75: Number(row.p75_per_unit ?? null),
              p90: Number(row.p90_per_unit ?? null),
            },
            pct_egi: row.p10_pct_egi != null ? {
              p10: Number(row.p10_pct_egi),
              p25: Number(row.p25_pct_egi),
              p50: Number(row.p50_pct_egi),
              p75: Number(row.p75_pct_egi),
              p90: Number(row.p90_pct_egi),
            } : null,
            sample_count: Number(row.sample_count),
          }));
          
          profileFound = profileBenchmarks.length > 0;
          logger.debug('fetch_line_item_benchmarks: profile-matched benchmarks', {
            fingerprint: input.building_profile_fingerprint,
            matched: profileBenchmarks.length,
          });
        } catch (profileErr) {
          logger.warn('fetch_line_item_benchmarks: profile benchmark query failed', {
            err: profileErr instanceof Error ? profileErr.message : String(profileErr),
          });
        }
      }
      
      const stillMissing = normalizedItems.filter(item => !foundItems.has(item));

      logger.debug('fetch_line_item_benchmarks: completed', {
        requested: line_items.length,
        found: benchmarks.length,
        missing: stillMissing.length,
        narrowestMatchLevel,
      });

      return {
        found: benchmarks.length > 0,
        benchmarks,
        missing_line_items: stillMissing,
        bucket_context: {
          state: state ?? null,
          msa: msa ?? null,
          asset_class: asset_class ?? null,
          deal_type: deal_type ?? null,
          vintage_band: vintage_band ?? null,
          narrowest_match_level: narrowestMatchLevel,
        },
        note: stillMissing.length > 0 
          ? `${stillMissing.length} line items not found in benchmarks — use conservative defaults`
          : undefined,
        profile_match: input.building_profile_fingerprint ? {
          found: profileFound,
          fingerprint: input.building_profile_fingerprint,
          benchmarks: profileBenchmarks,
          region: 'national',
        } : undefined,
      };

    } catch (err) {
      logger.error('fetch_line_item_benchmarks: query error', {
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        found: false,
        benchmarks: [],
        missing_line_items: input.line_items,
        bucket_context: {
          state: null,
          msa: null,
          asset_class: null,
          deal_type: null,
          vintage_band: null,
          narrowest_match_level: 'error',
        },
        note: 'Benchmark query failed — proceeding with conservative defaults',
        profile_match: input.building_profile_fingerprint ? {
          found: false,
          fingerprint: input.building_profile_fingerprint,
          benchmarks: [],
          region: 'national',
        } : undefined,
      };
    }
  },
};
