/**
 * Source Resolver — Executes LIUS source preference tier system.
 *
 * Given a schema and a deal context, resolves the value for each tier
 * by querying the appropriate data source, then applies the composite
 * source preference logic to produce a posterior.
 *
 * This is the engine that walks: T12 → owned portfolio → profile cluster
 * → archive/KG → broker OM → agent default
 */

import { type Pool } from 'pg';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import {
  type LIUSchema,
  type EvidenceSource,
  type ConfidenceScore,
  type HardRule,
} from './types';
import { getBuildingProfile } from '../building-profiles/building-profile.service';
import { getProfileBenchmarks } from '../building-profiles/building-profile.service';

export interface SourceResolverContext {
  dealId: string;
  dealType: 'acquisition' | 'development' | 'refi' | 'reforecast' | 'disposition';
  lifecyclePhase: string;
  state: string;
  county: string | null;
  units: number | null;
  purchasePrice: number | null;
  totalOpEx: number | null;
  effectiveGrossIncome: number | null;
  brokerAssumptions: Record<string, number> | null;
  // D2 (CE-M26 re-scope): submarket/MSA/property identifiers used by the
  // historical_observations Tier 3 query for `exit.exitCapRate`. All optional
  // because most line items don't need them — only the exit-cap resolution
  // path reads these. When absent for a deal, Tier 3 short-circuits to a
  // miss and the cascade falls through (loudly, via Tier 5).
  submarketId?: string | null;
  msaId?: string | null;
  propertyClass?: 'A' | 'B' | 'C' | null;
  // Going-in cap as a percent (e.g. 5.5 means 5.5%). Used by the
  // exitCapRate Tier 5 fallback (going-in + 25bps) — see queryTier5.
  goingInCapPct?: number | null;
}

export interface SourceResolverResult {
  posterior: {
    value: number;
    perUnit: number | null;
    pctEgi: number | null;
  };
  sources: EvidenceSource[];
  primaryTier: number;
  primarySource: string;
  confidence: ConfidenceScore;
  appliedHardRules: HardRule[];
}

/**
 * Resolve a single line item using the schema's source preference + context.
 */
export async function resolveLineItem(
  schema: LIUSchema,
  ctx: SourceResolverContext,
  pool?: Pool,
): Promise<SourceResolverResult> {
  const db = pool ?? getPool();
  const start = Date.now();
  
  // 1. Apply hard rules → adjust sourcePreference
  const activeRules = evaluateHardRules(schema, ctx);
  const sourcePreference = applyHardRuleEffects(schema.sourcePreference, activeRules);
  
  // 2. Execute each tier (in order) until posterior stabilizes
  const sources: EvidenceSource[] = [];
  
  for (const tier of sourcePreference) {
    const source = await queryTier(tier, schema, ctx, db);
    if (source) {
      sources.push(source);
    }
  }
  
  // 3. Compute posterior: primary source wins, cross-check adjusts
  const primarySource = sources[0];
  let posteriorValue = primarySource?.value ?? 0;
  let perUnit = primarySource?.perUnit ?? null;
  let pctEgi = primarySource?.pctEgi ?? null;
  
  // 4. Compute confidence
  const confidence = computeConfidence(sources, schema);
  
  // 5. Apply trajectory events for initial year scaling
  // (full trajectory engine is Week 2 — for now just compute base)
  const trajectoryEvents = schema.trajectory?.scheduledEvents ?? [];
  for (const event of trajectoryEvents) {
    if (event.year === 1 && event.primitive === 'level_reset' && event.value != null) {
      posteriorValue = event.value;
    }
  }
  
  return {
    posterior: { value: posteriorValue, perUnit, pctEgi },
    sources,
    primaryTier: primarySource?.tier ?? 5,
    primarySource: primarySource?.sourceKey ?? 'agent_default',
    confidence,
    appliedHardRules: activeRules,
  };
}

/**
 * Query a single tier's data source for this line item.
 */
async function queryTier(
  tier: number,
  schema: LIUSchema,
  ctx: SourceResolverContext,
  db: Pool,
): Promise<EvidenceSource | null> {
  switch (tier) {
    case 1:
      return queryTier1(schema, ctx, db);
    case 2:
      return queryTier2(schema, ctx, db);
    case 2.5:
      return queryTier2_5(schema, ctx, db);
    case 3:
      return queryTier3(schema, ctx, db);
    case 4:
      return queryTier4(schema, ctx);
    case 5:
      return queryTier5(schema, ctx);
    default:
      return null;
  }
}

/**
 * Tier 1: Deal-specific documents (T12, Rent Roll via deal_data).
 */
async function queryTier1(
  schema: LIUSchema,
  ctx: SourceResolverContext,
  db: Pool,
): Promise<EvidenceSource | null> {
  const liuid = schema.liuid;
  const key = liuid.split('.').pop()!; // e.g. "propertyTax" from "opex.propertyTax"
  
  // Query deal_data for line items
  const { rows } = await db.query(`
    SELECT dd.id, dd.total_units
    FROM deal_data dd
    WHERE dd.deal_id = $1 AND dd.source = 't12'
    ORDER BY dd.created_at DESC
    LIMIT 1
  `, [ctx.dealId]);
  
  if (rows.length === 0) return null;
  
  // Query line items from deal_data
  const { rows: lineRows } = await db.query(`
    SELECT annual_amount, pct_egi
    FROM deal_line_items
    WHERE deal_data_id = $1
      AND (line_item = $2 OR line_item_code = $2)
      AND annual_amount IS NOT NULL
    LIMIT 1
  `, [rows[0].id, key]);
  
  if (lineRows.length === 0) return null;
  
  const amount = Number(lineRows[0].annual_amount);
  const pct = lineRows[0].pct_egi != null ? Number(lineRows[0].pct_egi) : null;
  const totalUnits = rows[0].total_units ? Number(rows[0].total_units) : ctx.units;
  const perUnit = totalUnits && totalUnits > 0 ? amount / totalUnits : null;
  
  return {
    tier: 1,
    sourceKey: 't12',
    sourceLabel: 'T12 / Rent Roll',
    value: amount,
    perUnit,
    pctEgi: pct,
    freshness: 0.9,
    n: 1,
  };
}

/**
 * Tier 2: Owned portfolio actuals (deal_monthly_actuals).
 */
async function queryTier2(
  schema: LIUSchema,
  ctx: SourceResolverContext,
  db: Pool,
): Promise<EvidenceSource | null> {
  const key = schema.liuid.split('.').pop()!;
  
  const { rows } = await db.query(`
    SELECT 
      dma.line_item,
      AVG(dma.amount) AS avg_amount,
      COUNT(*) AS months,
      dma.unit_count
    FROM deal_monthly_actuals dma
    JOIN deals d ON d.id = dma.deal_id
    WHERE d.organization_id = (
      SELECT organization_id FROM deals WHERE id = $1
    )
    AND dma.line_item = $2
    AND dma.amount IS NOT NULL
    GROUP BY dma.line_item, dma.unit_count
    ORDER BY COUNT(*) DESC
    LIMIT 1
  `, [ctx.dealId, key]);
  
  if (rows.length === 0) return null;
  
  const monthlyAvg = Number(rows[0].avg_amount);
  const annual = monthlyAvg * 12;
  const unitCount = rows[0].unit_count ? Number(rows[0].unit_count) : ctx.units;
  const perUnit = unitCount && unitCount > 0 ? annual / unitCount : null;
  const months = Number(rows[0].months);
  
  return {
    tier: 2,
    sourceKey: 'owned_portfolio',
    sourceLabel: 'Owned Portfolio',
    value: annual,
    perUnit,
    pctEgi: null,
    n: Math.floor(months / 12),
    freshness: 0.8,
  };
}

/**
 * Tier 2.5: Building profile cluster benchmarks.
 */
async function queryTier2_5(
  schema: LIUSchema,
  ctx: SourceResolverContext,
  db: Pool,
): Promise<EvidenceSource | null> {
  if (!ctx.units) return null;
  
  const profile = await getBuildingProfile(ctx.dealId, db);
  if (!profile?.profileFingerprint) return null;
  
  const key = schema.liuid.split('.').pop()!;
  const benchmarks = await getProfileBenchmarks(profile.profileFingerprint, 'national', [key], db);
  
  if (benchmarks.length === 0) return null;
  
  const bm = benchmarks[0];
  if (bm.p50PerUnit == null) return null;
  
  const perUnit = bm.p50PerUnit;
  const value = perUnit * ctx.units;
  
  return {
    tier: 2.5,
    sourceKey: 'profile_cluster',
    sourceLabel: `Profile Cluster (${profile.buildingType} ${profile.vintageBand})`,
    value,
    perUnit,
    pctEgi: bm.p50PctEgi,
    n: bm.sampleCount,
    freshness: 0.7,
  };
}

/**
 * Tier 3: archive / corpus distribution.
 *
 * D2 (CE-13, CE-M26): the pre-D2 path queried `archive_line_items`, a
 * table with zero writers and no migration in the codebase. That query
 * unconditionally missed in production. Tier 3 is now split:
 *
 *  - For `exit.exitCapRate`: query historical_observations for realized
 *    cap-rate changes in the deal's submarket. Sparse until corpus
 *    Phase 4 (CoStar submarket ingestion). When sparse, returns null —
 *    cascade falls through to lower-priority tiers and ultimately to
 *    the loud Tier 5 fallback.
 *  - For everything else: returns null (the legacy archive_line_items
 *    path produced nothing anyway; preserving it would just be dead
 *    code paying compute rent). A future Tier 3 reader for opex /
 *    income / strategy line items will need its own corpus query.
 */
async function queryTier3(
  schema: LIUSchema,
  ctx: SourceResolverContext,
  db: Pool,
): Promise<EvidenceSource | null> {
  if (schema.liuid === 'exit.exitCapRate') {
    return queryTier3_ExitCapRate(ctx, db);
  }
  return null;
}

/**
 * Tier 3 specialized path for `exit.exitCapRate`.
 *
 * Reads `realized_cap_rate_change_t12_bps` and `realized_cap_rate_change_t24_bps`
 * from the most recent historical_observations rows for the deal's submarket,
 * then applies the median change to the going-in cap to produce the resolved
 * exit cap.
 *
 * Returns null when:
 *   - no submarket on the context (the resolver has no way to scope)
 *   - going-in cap absent (the change has no anchor)
 *   - the corpus has no realized cap-rate rows for this submarket
 *
 * "Returns null" here means the cascade proceeds to the next tier — that is
 * the correct behavior pre-corpus-Phase-4, and the eventual Tier 5 fallback
 * emits a loud telemetry event so the consumer can see the resolution rode
 * the crudest path.
 */
async function queryTier3_ExitCapRate(
  ctx: SourceResolverContext,
  db: Pool,
): Promise<EvidenceSource | null> {
  if (!ctx.submarketId || ctx.goingInCapPct == null) return null;

  // Prefer T12 realizations (more recent, closer to typical hold horizon);
  // fall back to T24 if T12 is unavailable. Take the median across the
  // submarket so a single outlier deal doesn't dominate.
  const { rows } = await db.query(`
    SELECT
      percentile_cont(0.50) WITHIN GROUP (
        ORDER BY realized_cap_rate_change_t12_bps
      ) FILTER (WHERE realized_cap_rate_change_t12_bps IS NOT NULL) AS t12_bps_median,
      percentile_cont(0.50) WITHIN GROUP (
        ORDER BY realized_cap_rate_change_t24_bps
      ) FILTER (WHERE realized_cap_rate_change_t24_bps IS NOT NULL) AS t24_bps_median,
      COUNT(*) FILTER (WHERE realized_cap_rate_change_t12_bps IS NOT NULL) AS t12_n
    FROM historical_observations
    WHERE submarket_id = $1
      AND realization_complete = TRUE
  `, [ctx.submarketId]);

  const row = rows[0];
  if (!row) return null;

  const t12Median = row.t12_bps_median != null ? Number(row.t12_bps_median) : null;
  const t24Median = row.t24_bps_median != null ? Number(row.t24_bps_median) : null;
  const n = Number(row.t12_n) || 0;

  // Corpus is empty for this submarket — short-circuit, let the cascade
  // proceed. This is the expected pre-corpus-Phase-4 path.
  if (t12Median == null && t24Median == null) return null;

  const changeBps = t12Median ?? t24Median!;
  // exitCap (decimal) = goingInCap (decimal) + change (bps → decimal)
  const exitCapPct = ctx.goingInCapPct + changeBps / 100;
  const value = exitCapPct / 100;

  return {
    tier: 3,
    sourceKey: 'historical_observations',
    sourceLabel: `Corpus realized cap change (${ctx.submarketId}, n=${n})`,
    value,
    perUnit: null,
    pctEgi: null,
    n,
    freshness: 0.65,
  };
}

/**
 * Tier 4: Broker OM assumption (for collision detection only).
 */
async function queryTier4(
  schema: LIUSchema,
  ctx: SourceResolverContext,
): Promise<EvidenceSource | null> {
  if (!ctx.brokerAssumptions) return null;
  
  const key = schema.liuid.split('.').pop()!;
  const value = ctx.brokerAssumptions[key];
  if (value == null) return null;
  
  return {
    tier: 4,
    sourceKey: 'broker_om',
    sourceLabel: 'Broker OM',
    value,
    perUnit: ctx.units ? value / ctx.units : null,
    pctEgi: null,
    freshness: 0.5,
  };
}

/**
 * Tier 5: Agent knowledge fallback (conservative default).
 *
 * D2 (CE-01, CE-M26 loud fallback): for `exit.exitCapRate`, this is the
 * "going-in cap + 25bps" path. When the cascade lands here we emit a
 * structured warn so operators can see the exit cap is running on its
 * crudest fallback rather than on empirical (corpus / profile / broker)
 * data — same observability discipline as D3's `sofr_forward_curve.fallback_heuristic`.
 */
function queryTier5(
  schema: LIUSchema,
  ctx: SourceResolverContext,
): EvidenceSource | null {
  // Exit cap rate has its own loud fallback path (going-in + 25bps).
  if (schema.liuid === 'exit.exitCapRate') {
    if (ctx.goingInCapPct == null) {
      // No anchor — can't even compute the conservative default.
      logger.warn('[LIUS] exit.exitCapRate Tier 5 fallback skipped — no going-in cap on context', {
        event: 'exit_cap.tier5_fallback_skipped_no_anchor',
        dealId: ctx.dealId,
      });
      return null;
    }
    const exitCapPct = ctx.goingInCapPct + 0.25;  // going-in % + 25 bps
    const value = exitCapPct / 100;
    logger.warn('[LIUS] exit.exitCapRate fell through to Tier 5 fallback (going-in + 25bps)', {
      event: 'exit_cap.tier5_fallback',
      dealId: ctx.dealId,
      submarketId: ctx.submarketId ?? null,
      goingInCapPct: ctx.goingInCapPct,
      exitCapPct,
      reason: ctx.submarketId
        ? 'corpus has no realized cap-rate rows for submarket'
        : 'no submarket on deal context',
    });
    return {
      tier: 5,
      sourceKey: 'fallback_going_in_plus_25bps',
      sourceLabel: 'Going-in + 25bps (fallback)',
      value,
      perUnit: null,
      pctEgi: null,
      freshness: 0.2,
    };
  }

  // Conservative defaults per archetype
  const defaults: Record<string, number> = {
    // OpEx
    propertyTax: ctx.purchasePrice ? ctx.purchasePrice * 0.01 : 0,
    insurance: ctx.units ? ctx.units * 500 : 0,
    utilities: ctx.units ? ctx.units * 800 : 0,
    repairsMaintenance: ctx.units ? ctx.units * 400 : 0,
    managementFee: ctx.effectiveGrossIncome ? ctx.effectiveGrossIncome * 0.03 : 0,
    payroll: ctx.units ? ctx.units * 1500 : 0,
    marketingAdmin: ctx.units ? ctx.units * 200 : 0,
    replacementReserves: ctx.units ? ctx.units * 250 : 0,

    // Income
    grossPotentialRent: ctx.units ? ctx.units * 18000 : 0,
    otherIncome: ctx.units ? ctx.units * 600 : 0,
    concessions: ctx.effectiveGrossIncome ? ctx.effectiveGrossIncome * -0.02 : 0,
    vacancyCollectionLoss: ctx.effectiveGrossIncome ? ctx.effectiveGrossIncome * -0.05 : 0,
    badDebt: ctx.effectiveGrossIncome ? ctx.effectiveGrossIncome * -0.0075 : 0,
    lossToLease: 0,
    utilityBillingIncome: ctx.units ? ctx.units * 180 : 0,
    parkingIncome: ctx.units ? ctx.units * 180 : 0,
    storageIncome: ctx.units ? ctx.units * 30 : 0,
    petRentIncome: ctx.units ? ctx.units * 300 : 0,
    laundryIncome: ctx.units ? ctx.units * 216 : 0,
    cableInternetIncome: ctx.units ? ctx.units * 96 : 0,
    applicationFeeIncome: ctx.units ? ctx.units * 20 : 0,
    lateFeeIncome: ctx.units ? ctx.units * 60 : 0,

    // Strategy
    valueAdd: ctx.units ? ctx.units * 15000 : 0,
    reposition: ctx.units ? ctx.units * 30000 : 0,
    unitUpgrades: ctx.units ? ctx.units * 10000 : 0,
    commonAreaImprovements: ctx.units ? ctx.units * 3000 : 0,
    deferredMaintenance: ctx.units ? ctx.units * 1000 : 0,

    // Capital
    roofReplacement: 250000,
    hvacReplacement: ctx.units ? ctx.units * 3000 : 0,
    parkingLot: 75000,
    elevators: 150000,
    structural: 50000,
    lifeSafety: 40000,
    exteriorEnvelope: 50000,
  };
  
  const key = schema.liuid.split('.').pop()!;
  const value = defaults[key];
  if (!value) return null;
  
  return {
    tier: 5,
    sourceKey: 'agent_default',
    sourceLabel: 'Conservative Default',
    value,
    perUnit: ctx.units ? value / ctx.units : null,
    pctEgi: null,
    freshness: 0.3,
  };
}

/**
 * Evaluate hard rules against deal context.
 * Returns only the rules that fire.
 */
function evaluateHardRules(
  schema: LIUSchema,
  ctx: SourceResolverContext,
): HardRule[] {
  const fired: HardRule[] = [];
  
  for (const rule of schema.hardRules ?? []) {
    try {
      const condition = rule.condition;
      
      // Simple condition matching
      if (
        (condition.includes('FL') && ctx.state === 'FL') ||
        (condition.includes('coastal') && ['FL'].includes(ctx.state)) ||
        (condition.includes('acquisition') && ctx.dealType === 'acquisition') ||
        (condition.includes('development') && ctx.dealType === 'development')
      ) {
        fired.push(rule);
      }
    } catch {
      logger.warn(`[LIUS] Hard rule evaluation error for ${schema.liuid}: ${rule.condition}`);
    }
  }
  
  return fired;
}

/**
 * Apply hard rule effects to source preference list.
 */
function applyHardRuleEffects(
  sourcePreference: number[],
  activeRules: HardRule[],
): number[] {
  if (activeRules.length === 0) return sourcePreference;
  
  let result = [...sourcePreference];
  
  for (const rule of activeRules) {
    for (const action of rule.effect.sourceActions ?? []) {
      if (action.action === 'remove') {
        result = result.filter(t => t !== action.tier);
      } else if (action.action === 'replace') {
        const idx = result.indexOf(action.tier);
        if (idx >= 0) {
          result[idx] = action.tier; // same tier, different query logic
        }
      }
    }
  }
  
  return result;
}

/**
 * Composite confidence scoring function.
 */
function computeConfidence(
  sources: EvidenceSource[],
  schema: LIUSchema,
): ConfidenceScore {
  if (sources.length === 0) {
    return { score: 0, level: 'low', posteriorP10: null, posteriorP90: null, weakestLinks: ['no_sources'] };
  }
  
  // Freshness component
  const freshness = sources.reduce((sum, s) => sum + (s.freshness ?? 0.3), 0) / sources.length;
  
  // Sample count component
  const maxN = Math.max(...sources.map(s => s.n ?? 1));
  const sampleFactor = Math.min(1, maxN / (schema.confidence?.minSampleForHigh ?? 30));
  
  // Cross-source concordance (how well do sources agree?)
  const values = sources.filter(s => s.value != null && s.value > 0).map(s => s.value!);
  const concordance = values.length >= 2
    ? 1 - (Math.max(...values) - Math.min(...values)) / Math.max(...values)
    : 1;
  
  // Weighted composite
  const score = freshness * 0.35 + sampleFactor * 0.35 + Math.max(0, concordance) * 0.3;
  
  // Decode
  const level = score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low';
  
  const weakestLinks: string[] = [];
  if (freshness < 0.5) weakestLinks.push('source_freshness');
  if (sampleFactor < 0.3) weakestLinks.push('small_sample');
  if (concordance < 0.5) weakestLinks.push('source_conflict');
  
  return {
    score,
    level,
    posteriorP10: values.length > 0 ? Math.min(...values) * 0.85 : null,
    posteriorP90: values.length > 0 ? Math.max(...values) * 1.15 : null,
    weakestLinks,
  };
}

export default {
  resolveLineItem,
};
