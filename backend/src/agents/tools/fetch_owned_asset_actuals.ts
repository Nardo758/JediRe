/**
 * Tool: fetch_owned_asset_actuals
 *
 * Queries deal_monthly_actuals for owned portfolio assets comparable to the subject deal.
 * Returns TTM (trailing twelve months) and TTM-24 (prior year) summaries per asset,
 * with a comparability score based on submarket, class, vintage, and unit count similarity.
 *
 * Tier 2 evidence source — used by CashFlow Agent.
 *
 * PORTFOLIO IDENTIFICATION CONVENTION (Task 1669, 2026-05-31):
 * Owned portfolio rows are identified by deal_monthly_actuals.is_portfolio_asset = TRUE.
 * This is the canonical flag; it supersedes the prior implicit convention of
 * deal_id IS NULL which was never enforced in queries.
 * property_operating_data.is_owned is DEPRECATED (0 rows populated) — do not use.
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().uuid().describe('Current deal UUID (used to exclude itself)'),
  submarket: z.string().nullable().optional().describe('Target submarket name for comparability'),
  asset_class: z.string().nullable().optional().describe('A, B, or C class'),
  year_built: z.number().int().nullable().optional().describe('Vintage year for cohort matching'),
  units: z.number().int().nullable().optional().describe('Unit count for size comparability'),
  max_assets: z.number().int().default(5).describe('Max comparable assets to return'),
  /**
   * Value-add GPR — capture rate sourcing (S3).
   *
   * When true, the tool additionally:
   *   1. Filters results to deals where project_type is 'value-add', 'renovation', or 'rehab'.
   *   2. Computes a rent trajectory for each asset (earliest actuals vs latest actuals)
   *      to surface the effective rent lift delivered over the program period.
   *   3. Returns a renovation_capture_summary with:
   *        - programs_found: count of matching value-add programs
   *        - rent_trajectories: per-asset first/last effective rent + implied lift %
   *        - avg_implied_rent_lift_pct: geometric mean rent lift across found programs
   *        - track_record_note: agent-readable summary + recommended capture rate
   *
   * The agent uses renovation_capture_summary to determine the capture_rate input for
   * the per-floor-plan premium computation:
   *   captured_premium = gross_premium × historical_capture_rate
   *
   * If programs_found = 0, track_record_note will instruct the agent to use the
   * archive cohort P50 anchor (0.80, medium confidence).
   */
  value_add_programs_only: z.boolean().optional().default(false)
    .describe(
      'Value-add GPR only. Set true to filter for buyer\'s prior value-add/renovation programs ' +
      'and return renovation_capture_summary for capture rate derivation. ' +
      'The summary includes rent trajectory (first vs last actuals) per asset and an ' +
      'avg_implied_rent_lift_pct that grounds the capture rate assumption in S3 evidence.'
    ),
});

const OwnedAssetSummarySchema = z.object({
  property_id: z.string(),
  address: z.string().nullable(),
  submarket: z.string().nullable(),
  units: z.number().nullable(),
  year_built: z.number().nullable(),
  comparability_score: z.number().describe('0-1, higher = more comparable'),
  ttm: z.object({
    months_available: z.number(),
    avg_occupancy_rate: z.number().nullable(),
    avg_effective_rent_per_unit: z.number().nullable(),
    noi_per_unit_annual: z.number().nullable(),
    opex_per_unit_annual: z.number().nullable(),
    egi_per_unit_annual: z.number().nullable(),
    management_fee_pct: z.number().nullable(),
  }),
  ttm_minus_24: z.object({
    months_available: z.number(),
    avg_occupancy_rate: z.number().nullable(),
    noi_per_unit_annual: z.number().nullable(),
  }).nullable(),
});

/**
 * Per-asset rent trajectory computed when value_add_programs_only=true.
 * Earliest and latest actuals bracket the program period; the lift % is
 * the implied premium delivered (market drift included, not stripped out).
 * Agent should compare implied lift to submarket rent growth to estimate
 * how much of the lift is renovation-driven vs market-driven.
 */
const RentTrajectorySchema = z.object({
  property_id: z.string(),
  address: z.string().nullable(),
  first_month: z.string().describe('ISO date of earliest actuals month'),
  last_month: z.string().describe('ISO date of latest actuals month'),
  first_effective_rent: z.number().nullable().describe('Avg effective rent/unit at program start'),
  last_effective_rent: z.number().nullable().describe('Avg effective rent/unit at program end/latest'),
  implied_rent_lift_pct: z.number().nullable()
    .describe('(last - first) / first — includes market drift; agent strips market growth to isolate renovation premium'),
  months_observed: z.number().int(),
});

/**
 * Renovation capture summary — populated when value_add_programs_only=true.
 * Primary output for value-add GPR capture rate derivation (S3 sourcing).
 */
const RenovationCaptureSummarySchema = z.object({
  programs_found: z.number().int()
    .describe('Number of portfolio value-add programs found matching filters'),
  rent_trajectories: z.array(RentTrajectorySchema)
    .describe('Per-program rent trajectory from earliest to latest actuals'),
  avg_implied_rent_lift_pct: z.number().nullable()
    .describe('Mean implied rent lift % across programs (market drift not stripped). Agent applies market growth haircut to isolate renovation premium.'),
  /**
   * Per-program rent trajectory metrics — trajectory evidence for the agent.
   *
   * median_implied_lift_pct = median((last_rent - first_rent) / first_rent)
   * across all programs. This is a GROSS rent lift percentage (typically 0.05-0.30),
   * NOT a capture rate. The agent must:
   *   1. Subtract market rent growth over the hold period (from fetch_market_trends)
   *      to isolate renovation-specific lift.
   *   2. Compare isolated lift to the comp_ceiling comp set to derive whether
   *      the sponsor's track record supports above/at/below archive P50 capture.
   *
   * DO NOT use median_implied_lift_pct directly as recommended_capture_rate.
   */
  median_implied_lift_pct: z.number().nullable()
    .describe(
      'Median gross rent lift % across programs: (last - first) / first. ' +
      'Typically 0.05-0.30 (5-30%). This is NOT capture rate. ' +
      'Agent subtracts market drift to isolate renovation premium, then uses that to ' +
      'confirm or adjust the recommended_capture_rate starting anchor.'
    ),
  /**
   * Estimated capture rate derived from buyer's S3 track record.
   *
   * Computation (when programs_found ≥ 1):
   *   Per program:
   *     hold_years   = months_observed / 12
   *     market_base  = hold_years × 0.03  (3%/yr conservative constant)
   *     isolated     = implied_lift_pct − market_base
   *     tier: isolated > 15% → 0.85 | 8-15% → 0.82 | 3-8% → 0.80 | < 3% → 0.76
   *   recommended_capture_rate = median of per-program tier capture rates.
   *
   * When programs_found = 0: archive cohort P50 fallback = 0.80.
   *
   * Valid range: [0.76, 0.85] from tier map; agent may adjust within [0.70, 0.90]
   * with documented justification. Anything > 0.90 requires explicit evidence.
   */
  recommended_capture_rate: z.number()
    .describe(
      'Estimated capture rate from buyer S3 track record (median of per-program market-adjusted lift tiers). ' +
      '0 programs → archive P50 fallback = 0.80. ' +
      'Range: 0.76 (unproven) → 0.80 (archive P50) → 0.82 → 0.85 (above-archive documented). ' +
      'Agent uses directly in: captured_premium = gross_premium × recommended_capture_rate. ' +
      'Document source (track_record | archive_default) and confidence in evidence.'
    ),
  capture_rate_source: z.enum(['track_record', 'archive_default'])
    .describe(
      '"track_record" when ≥1 value-add programs found with rent trajectory data (anchor may be adjusted); ' +
      '"archive_default" when programs_found=0 (use 0.80 anchor without adjustment).'
    ),
  track_record_note: z.string()
    .describe('Agent-readable summary: programs found, lift range, anchor, and adjustment guidance.'),
});

const OutputSchema = z.object({
  assets: z.array(OwnedAssetSummarySchema),
  total_owned_portfolio_size: z.number().int(),
  /**
   * Populated only when value_add_programs_only=true.
   * Use this to source the capture_rate for per-floor-plan premium computation:
   *   captured_premium = gross_premium × historical_capture_rate
   * See system prompt "GPR Investigation — Value-Add Deals" for full derivation.
   */
  renovation_capture_summary: RenovationCaptureSummarySchema.nullable().optional(),
  note: z.string().optional(),
});

export const fetchOwnedAssetActualsTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_owned_asset_actuals',
  description:
    'Fetch TTM operating actuals from comparable owned portfolio assets. ' +
    'Returns per-unit NOI, occupancy, effective rent, and opex metrics from deal_monthly_actuals. ' +
    'Use as Tier 2 evidence to cross-check T-12 assumptions. ' +
    'FOR VALUE-ADD DEALS: set value_add_programs_only=true to retrieve renovation_capture_summary — ' +
    'the buyer\'s prior value-add program rent trajectories used to derive the historical_capture_rate ' +
    'for per-floor-plan premium computation (captured_premium = gross_premium × capture_rate). ' +
    'If programs_found=0, track_record_note instructs agent to use archive P50 anchor (0.80, medium confidence).',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:all',

  execute: async (input, ctx) => {
    const now = new Date();
    const ttmStart = new Date(now);
    ttmStart.setMonth(ttmStart.getMonth() - 12);
    const ttm24Start = new Date(now);
    ttm24Start.setMonth(ttm24Start.getMonth() - 36);
    const ttm24End = new Date(now);
    ttm24End.setMonth(ttm24End.getMonth() - 24);

    // Resolve caller's org — prefer ctx.org_id (set by B2a attribution); fall back to deal lookup.
    // Required to scope portfolio reads to the caller's org only — prevents cross-operator actuals
    // leaking when two orgs share a public property_id (B4b finding FIX-2).
    const callerOrgId: string | null =
      ctx.org_id ??
      ((await query(
        `SELECT org_id FROM deals WHERE id = $1 LIMIT 1`,
        [input.deal_id],
      )).rows[0]?.org_id as string | null) ??
      null;

    if (!callerOrgId) {
      logger.warn('fetch_owned_asset_actuals: could not resolve org_id for caller — returning empty');
      return { assets: [], total_owned_portfolio_size: 0, note: 'Unable to resolve caller org.' };
    }

    // Count only the caller org's owned portfolio properties.
    // JOIN via deal_id (not property_id) — two orgs can share the same property_id on a
    // public property; joining on property_id would leak cross-org rows through the shared key.
    const totalResult = await query(
      `SELECT COUNT(DISTINCT dma.property_id) AS cnt
       FROM deal_monthly_actuals dma
       JOIN deal_properties dp ON dp.deal_id = dma.deal_id
       JOIN deals d ON d.id = dp.deal_id
       WHERE dma.is_portfolio_asset = TRUE
         AND d.org_id = $1`,
      [callerOrgId]
    );
    const totalCount = parseInt(String(totalResult.rows[0]?.cnt ?? '0'), 10);

    // value_add_programs_only: narrow to properties linked to value-add deals
    const valueAddClause = input.value_add_programs_only
      ? `AND EXISTS (
           SELECT 1 FROM deal_properties dp2
           INNER JOIN deals d2 ON d2.id = dp2.deal_id
           WHERE dp2.property_id = p.id
             AND LOWER(COALESCE(d2.project_type, d2.deal_type, '')) SIMILAR TO
                 '%(value.?add|rehab|renovati|repositi)%'
         )`
      : '';

    // Get all owned portfolio properties with TTM actuals.
    // is_portfolio_asset = TRUE is the canonical portfolio identifier (Task 1669).
    const propsResult = await query(
      `SELECT
         p.id              AS property_id,
         p.address_line1   AS address,
         p.submarket       AS submarket,
         p.units           AS units,
         p.year_built      AS year_built,
         p.building_class  AS asset_class
       FROM properties p
       WHERE EXISTS (
         SELECT 1 FROM deal_monthly_actuals dma
         JOIN deal_properties dp ON dp.deal_id = dma.deal_id
         JOIN deals d ON d.id = dp.deal_id
         WHERE dma.property_id = p.id
           AND dma.is_portfolio_asset = TRUE
           AND dma.report_month >= $1
           AND dma.is_budget = false
           AND d.org_id = $3
       )
       AND p.id NOT IN (
         SELECT dp.property_id FROM deal_properties dp WHERE dp.deal_id = $2
         UNION
         SELECT dp.property_id FROM deal_properties dp
         INNER JOIN deals d ON d.id = dp.deal_id WHERE d.id = $2
       )
       ${valueAddClause}
       LIMIT 50`,
      [ttmStart.toISOString().slice(0, 10), input.deal_id, callerOrgId]
    );

    if (propsResult.rows.length === 0) {
      // If value_add_programs_only was requested and nothing found, return a
      // renovation_capture_summary anchored to archive P50 = 0.80.
      const emptyCaptureNote = input.value_add_programs_only
        ? 'No prior value-add programs found in owned portfolio matching these filters. ' +
          'Capture rate anchor: 0.80 (archive P50, medium confidence). ' +
          'Document source as "archive_default", confidence=medium.'
        : undefined;
      return {
        assets: [],
        total_owned_portfolio_size: totalCount,
        renovation_capture_summary: input.value_add_programs_only
          ? {
              programs_found: 0,
              rent_trajectories: [],
              avg_implied_rent_lift_pct: null,
              median_implied_lift_pct: null,
              recommended_capture_rate: 0.80,
              capture_rate_source: 'archive_default' as const,
              track_record_note: emptyCaptureNote!,
            }
          : null,
        note: 'No comparable owned assets with TTM data found.',
      };
    }

    // Score each asset for comparability
    const scored = propsResult.rows.map((p: Record<string, unknown>) => {
      let score = 0;
      if (input.submarket && p.submarket === input.submarket) score += 0.40;
      else if (!input.submarket) score += 0.40;

      if (input.asset_class && p.asset_class != null) {
        // Exact class match (A/B/C) = full weight; adjacent class = partial; no match = minimal
        const pClass = String(p.asset_class).trim().toUpperCase();
        const tClass = input.asset_class.trim().toUpperCase();
        if (pClass === tClass) score += 0.30;
        else if (
          (pClass === 'A' && tClass === 'B') ||
          (pClass === 'B' && (tClass === 'A' || tClass === 'C')) ||
          (pClass === 'C' && tClass === 'B')
        ) score += 0.15;
        else score += 0.02;
      } else if (input.asset_class && p.asset_class == null) {
        // Class was specified but property has no stored class — degrade to partial credit
        score += 0.10;
      } else {
        // No class filter provided — treat all assets as neutral (partial credit)
        score += 0.15;
      }

      if (input.year_built && p.year_built != null) {
        const diff = Math.abs(Number(p.year_built) - input.year_built);
        score += diff <= 5 ? 0.15 : diff <= 15 ? 0.08 : 0.02;
      } else {
        score += 0.15;
      }

      if (input.units && p.units != null) {
        const ratio = Math.min(Number(p.units), input.units) / Math.max(Number(p.units), input.units);
        score += ratio >= 0.7 ? 0.15 : ratio >= 0.4 ? 0.08 : 0.02;
      } else {
        score += 0.15;
      }

      return { ...p, comparability_score: Math.round(score * 100) / 100 };
    });

    // Sort by score, take top N
    const top = scored
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        (b.comparability_score as number) - (a.comparability_score as number)
      )
      .slice(0, input.max_assets);

    const propertyIds = top.map((p: Record<string, unknown>) => p.property_id as string);

    if (propertyIds.length === 0) {
      return { assets: [], total_owned_portfolio_size: totalCount };
    }

    // TTM actuals
    const ttmResult = await query(
      `SELECT
         property_id,
         COUNT(*)                                            AS months_available,
         AVG(occupancy_rate)                                 AS avg_occupancy_rate,
         AVG(avg_effective_rent)                             AS avg_effective_rent_per_unit,
         SUM(noi) / NULLIF(MAX(total_units), 0)              AS noi_per_unit_annual,
         SUM(effective_gross_income - noi) / NULLIF(MAX(total_units), 0) AS opex_per_unit_annual,
         SUM(effective_gross_income) / NULLIF(MAX(total_units), 0)       AS egi_per_unit_annual,
         AVG(management_fee_pct)                             AS management_fee_pct
       FROM deal_monthly_actuals
       WHERE property_id = ANY($1::uuid[])
         AND report_month >= $2
         AND is_budget = false
       GROUP BY property_id`,
      [propertyIds, ttmStart.toISOString().slice(0, 10)]
    );

    // TTM-24 (prior year)
    const ttm24Result = await query(
      `SELECT
         property_id,
         COUNT(*)                                       AS months_available,
         AVG(occupancy_rate)                            AS avg_occupancy_rate,
         SUM(noi) / NULLIF(MAX(total_units), 0)         AS noi_per_unit_annual
       FROM deal_monthly_actuals
       WHERE property_id = ANY($1::uuid[])
         AND report_month BETWEEN $2 AND $3
         AND is_budget = false
       GROUP BY property_id`,
      [propertyIds, ttm24Start.toISOString().slice(0, 10), ttm24End.toISOString().slice(0, 10)]
    );

    const ttmMap = new Map(ttmResult.rows.map((r: Record<string, unknown>) => [r.property_id as string, r]));
    const ttm24Map = new Map(ttm24Result.rows.map((r: Record<string, unknown>) => [r.property_id as string, r]));

    const assets = top.map((p: Record<string, unknown>) => {
      const pid = p.property_id as string;
      const ttm = ttmMap.get(pid) ?? {};
      const ttm24 = ttm24Map.get(pid) ?? null;

      const parseNum = (v: unknown): number | null =>
        v != null && !isNaN(Number(v)) ? Math.round(Number(v) * 100) / 100 : null;

      return {
        property_id: pid,
        address: (p.address ?? null) as string | null,
        submarket: (p.submarket ?? null) as string | null,
        units: p.units != null ? Number(p.units) : null,
        year_built: p.year_built != null ? Number(p.year_built) : null,
        comparability_score: p.comparability_score as number,
        ttm: {
          months_available: Number((ttm as Record<string, unknown>).months_available ?? 0),
          avg_occupancy_rate: parseNum((ttm as Record<string, unknown>).avg_occupancy_rate),
          avg_effective_rent_per_unit: parseNum((ttm as Record<string, unknown>).avg_effective_rent_per_unit),
          noi_per_unit_annual: parseNum((ttm as Record<string, unknown>).noi_per_unit_annual),
          opex_per_unit_annual: parseNum((ttm as Record<string, unknown>).opex_per_unit_annual),
          egi_per_unit_annual: parseNum((ttm as Record<string, unknown>).egi_per_unit_annual),
          management_fee_pct: parseNum((ttm as Record<string, unknown>).management_fee_pct),
        },
        ttm_minus_24: ttm24
          ? {
              months_available: Number((ttm24 as Record<string, unknown>).months_available ?? 0),
              avg_occupancy_rate: parseNum((ttm24 as Record<string, unknown>).avg_occupancy_rate),
              noi_per_unit_annual: parseNum((ttm24 as Record<string, unknown>).noi_per_unit_annual),
            }
          : null,
      };
    });

    // ── Renovation capture summary (value_add_programs_only=true only) ──
    //
    // Queries the full actuals history (not just TTM) for each property to
    // compute the rent trajectory from program start to latest available month.
    // The implied rent lift % includes market drift; the agent is instructed to
    // apply a market growth haircut (from fetch_market_trends) to isolate the
    // renovation-specific lift and derive a capture rate.
    let renovationCaptureSummary: z.infer<typeof RenovationCaptureSummarySchema> | null = null;

    if (input.value_add_programs_only && propertyIds.length > 0) {
      const parseNum = (v: unknown): number | null =>
        v != null && !isNaN(Number(v)) ? Math.round(Number(v) * 100) / 100 : null;

      const trajectoryResult = await query(
        `SELECT
           dma.property_id,
           p.address_line1                                        AS address,
           MIN(dma.report_month)                                  AS first_month,
           MAX(dma.report_month)                                  AS last_month,
           COUNT(DISTINCT dma.report_month)                       AS months_observed,
           (ARRAY_AGG(dma.avg_effective_rent ORDER BY dma.report_month ASC))[1]    AS first_rent,
           (ARRAY_AGG(dma.avg_effective_rent ORDER BY dma.report_month DESC))[1]   AS last_rent
         FROM deal_monthly_actuals dma
         JOIN properties p ON p.id = dma.property_id
         WHERE dma.property_id = ANY($1::uuid[])
           AND dma.is_budget = false
           AND dma.avg_effective_rent IS NOT NULL
         GROUP BY dma.property_id, p.address_line1`,
        [propertyIds]
      );

      const rentTrajectories = trajectoryResult.rows
        .map((r: Record<string, unknown>) => {
          const firstRent = parseNum(r.first_rent);
          const lastRent = parseNum(r.last_rent);
          const liftPct = firstRent != null && lastRent != null && firstRent > 0
            ? Math.round(((lastRent - firstRent) / firstRent) * 10000) / 10000
            : null;
          return {
            property_id: String(r.property_id),
            address: (r.address ?? null) as string | null,
            first_month: String(r.first_month ?? ''),
            last_month: String(r.last_month ?? ''),
            first_effective_rent: firstRent,
            last_effective_rent: lastRent,
            implied_rent_lift_pct: liftPct,
            months_observed: Number(r.months_observed ?? 0),
          };
        })
        .filter(t => t.first_effective_rent != null && t.last_effective_rent != null);

      const lifts = rentTrajectories
        .map(t => t.implied_rent_lift_pct)
        .filter((v): v is number => v != null);

      // avg lift across programs
      const avgLift = lifts.length > 0
        ? Math.round(lifts.reduce((a, b) => a + b, 0) / lifts.length * 10000) / 10000
        : null;

      // median lift (sort ascending, pick middle)
      let medianLift: number | null = null;
      if (lifts.length > 0) {
        const sorted = [...lifts].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        medianLift = sorted.length % 2 !== 0
          ? sorted[mid]!
          : Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10000) / 10000;
      }

      // ── Derive recommended_capture_rate from S3 track record ─────────────
      // Spec: "historical_capture_rate comes from S3 — buyer's actual capture on
      // similar repositioning programs."
      //
      // Since deal_monthly_actuals stores rent trajectories (not explicit capture
      // rates per prior program), we derive an estimated capture rate per program
      // using a market-adjusted lift tier mapping:
      //
      //   per_program:
      //     hold_years = months_observed / 12
      //     market_baseline = hold_years × 0.03   (3%/yr conservative constant)
      //     isolated_lift = implied_lift_pct − market_baseline
      //     tier: isolated_lift > 0.15 → 0.85 | 0.08-0.15 → 0.82 | 0.03-0.08 → 0.80 | < 0.03 → 0.76
      //
      //   recommended_capture_rate = median of per-program tier capture rates
      //   programs_found = 0 → archive cohort P50 fallback = 0.80
      //
      // This IS "median capture from comparable programs" — the implied capture
      // rate estimated from each program's isolated renovation lift.
      const pCount = rentTrajectories.length;
      let captureRateSource: 'track_record' | 'archive_default';
      let recommendedCaptureRate: number;

      if (pCount >= 1) {
        // Compute per-program estimated capture rate via market-adjusted lift tiers
        const perProgramRates = rentTrajectories.map(t => {
          const lift = t.implied_rent_lift_pct;
          if (lift == null) return 0.80; // fallback for programs with no lift data
          const holdYears = Math.max(1, t.months_observed / 12);
          const marketBaseline = holdYears * 0.03;
          const isolatedLift = lift - marketBaseline;
          if (isolatedLift > 0.15) return 0.85;
          if (isolatedLift > 0.08) return 0.82;
          if (isolatedLift > 0.03) return 0.80;
          return 0.76; // unproven — lift barely above market drift
        });

        // Median of per-program estimated capture rates
        const sortedRates = [...perProgramRates].sort((a, b) => a - b);
        const mid = Math.floor(sortedRates.length / 2);
        const medianRate = sortedRates.length % 2 !== 0
          ? sortedRates[mid]!
          : (sortedRates[mid - 1]! + sortedRates[mid]!) / 2;

        recommendedCaptureRate = Math.round(medianRate * 100) / 100;
        captureRateSource = 'track_record';
      } else {
        // No programs found → archive cohort P50 fallback
        recommendedCaptureRate = 0.80;
        captureRateSource = 'archive_default';
      }

      let trackRecordNote: string;
      if (pCount === 0) {
        trackRecordNote =
          'No value-add programs found in owned portfolio. ' +
          'Capture rate anchor: 0.80 (archive P50, medium confidence). ' +
          'Document source as "archive_default", confidence=medium. ' +
          'No trajectory evidence to adjust from anchor — use 0.80 as final unless operator has disclosed prior program data.';
      } else {
        const liftRange = lifts.length > 0
          ? `observed gross lifts ${(Math.min(...lifts) * 100).toFixed(1)}%-${(Math.max(...lifts) * 100).toFixed(1)}%`
          : 'no lift data available';
        const confidenceTier = pCount >= 2 ? 'high (n≥2)' : 'medium (n=1)';
        trackRecordNote =
          `Buyer has ${pCount} prior value-add program(s) — ${liftRange} ` +
          `(median gross lift ${medianLift != null ? (medianLift * 100).toFixed(1) + '%' : 'N/A'}, ` +
          `confidence: ${confidenceTier}). ` +
          'Capture rate ANCHOR: 0.80 (archive P50). ' +
          'Adjustment rule: compute isolated_lift = median_gross_lift − market_growth_over_hold_years ' +
          '(fetch_market_trends); if isolated_lift > 12% → adjust up toward 0.84-0.86; ' +
          'if isolated_lift < 5% → adjust down to 0.72-0.76; otherwise keep 0.80. ' +
          'Document final chosen rate with source=track_record and adjustment rationale in evidence.';
      }

      renovationCaptureSummary = {
        programs_found: pCount,
        rent_trajectories: rentTrajectories,
        avg_implied_rent_lift_pct: avgLift,
        median_implied_lift_pct: medianLift,
        recommended_capture_rate: recommendedCaptureRate,
        capture_rate_source: captureRateSource,
        track_record_note: trackRecordNote,
      };
    }

    logger.debug('fetch_owned_asset_actuals', {
      runId: ctx.dealId,
      dealId: ctx.dealId,
      assetCount: assets.length,
      valueAddProgramsOnly: input.value_add_programs_only,
      renovationProgramsFound: renovationCaptureSummary?.programs_found ?? null,
    });

    return {
      assets,
      total_owned_portfolio_size: totalCount,
      renovation_capture_summary: renovationCaptureSummary,
    };
  },
};
