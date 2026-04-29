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
 * Tier 3: Knowledge Graph / archive distribution.
 */
async function queryTier3(
  schema: LIUSchema,
  ctx: SourceResolverContext,
  db: Pool,
): Promise<EvidenceSource | null> {
  const key = schema.liuid.split('.').pop()!;
  
  // Query archive_deals for comparable benchmarks
  const { rows } = await db.query(`
    SELECT 
      percentile_cont(0.50) WITHIN GROUP (ORDER BY annual_amount) AS p50,
      COUNT(*) AS n
    FROM archive_line_items ali
    JOIN archive_deals ad ON ad.id = ali.archive_deal_id
    WHERE ali.line_item = $1
      AND ali.annual_amount IS NOT NULL
      AND ad.state = $2
    LIMIT 1
  `, [key, ctx.state]);
  
  if (rows.length === 0 || rows[0].p50 == null) return null;
  
  const perUnit = Number(rows[0].p50);
  const n = Number(rows[0].n);
  const value = ctx.units ? perUnit * ctx.units : perUnit;
  
  return {
    tier: 3,
    sourceKey: 'archive',
    sourceLabel: `Archive (${ctx.state})`,
    value,
    perUnit,
    pctEgi: null,
    n,
    freshness: 0.6,
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
 */
function queryTier5(
  schema: LIUSchema,
  ctx: SourceResolverContext,
): EvidenceSource | null {
  // Conservative defaults per archetype
  const defaults: Record<string, number> = {
    propertyTax: ctx.purchasePrice ? ctx.purchasePrice * 0.01 : 0,
    insurance: ctx.units ? ctx.units * 500 : 0,
    utilities: ctx.units ? ctx.units * 800 : 0,
    repairsMaintenance: ctx.units ? ctx.units * 400 : 0,
    managementFee: ctx.effectiveGrossIncome ? ctx.effectiveGrossIncome * 0.03 : 0,
    payroll: ctx.units ? ctx.units * 1500 : 0,
    marketingAdmin: ctx.units ? ctx.units * 200 : 0,
    replacementReserves: ctx.units ? ctx.units * 250 : 0,
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
