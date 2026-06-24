/**
 * LIUS Engine — Orchestrates line-item underwriting across a deal.
 *
 * The engine:
 *  1. Loads schema catalog
 *  2. Builds dependency DAG
 *  3. Resolves each line item in topological order
 *  4. Produces full evidence output with collision reports
 *  5. Returns structured data the Evidence Panel + Commentary Agent consume
 */

import { type Pool } from 'pg';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { loadSchemaCatalog, getSchema } from './schema-catalog';
import { resolveLineItem, type SourceResolverContext } from './source-resolver';
import {
  type LIUSchema,
  type Evidence,
  type CollisionReport,
  type CrossCheck,
  type TrajectoryEvent,
  type ConfidenceScore,
} from './types';
import {
  projectTrajectory,
  generateLifecycleEvents,
  type YearProjection,
  type TrajectoryContext,
  type LifecyclePhaseTimeline,
} from './trajectory-engine';
import { type LocationTarget } from '../m35-traffic-api.service';
import {
  fetchM35TrajectorySignals,
  toGrowthRateOverrides,
  buildAbsorptionSpikeEvent,
  type M35TrajectorySignals,
} from './m35-bridge';
import { cycleIntelligenceService } from '../cycle-intelligence.service';

export interface LIUSEngineContext {
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
  sectionFilter?: string[];   // optional: only run specific sections
  holdPeriodYears?: number;    // default 10
  lifecycleTimeline?: LifecyclePhaseTimeline[];  // phase transitions
  profileEvents?: Record<string, TrajectoryEvent[]>;  // events by liuid
  pcaEvents?: Record<string, TrajectoryEvent[]>;      // PCA-derived events by liuid
  /**
   * Deal location for M35 trajectory enrichment (W-02).
   * When present, the engine pre-fetches live market-event signals and injects:
   *   - An adjusted exit_cap_trajectory rate into trajectory contexts for schemas
   *     whose baseGrowth driver is 'exit_cap_trajectory'.
   *   - A Year-1 discrete_spike event into leaseUp.leaseUpAbsorption from any
   *     active multifamily_delivery events within 5 miles.
   * When absent, DEFAULT_GROWTH_RATES constants are used unchanged (backward compatible).
   */
  location?: LocationTarget;
  /**
   * CE-16 F3 (W-08): MSA/market ID for M28 cycle intelligence overlay.
   * When present, the engine calls predictCapRateMovement() and blends
   * the macro-cycle cap rate prediction into exit_cap_trajectory (50/50
   * with the M35 signal). Null/absent → no M28 overlay (backward compatible).
   */
  marketId?: string;
}

export interface LIUSEngineResult {
  dealId: string;
  version: string;
  evidence: Evidence[];
  bySection: Record<string, Evidence[]>;
  summary: {
    totalLines: number;
    resolved: number;
    confidenceHigh: number;
    confidenceMedium: number;
    confidenceLow: number;
    collisions: number;
    severeCollisions: number;
  };
  elapsedMs: number;
}

/**
 * Run the LIUS engine for a full deal.
 * PF-06 NOTE: This function has zero production callers — only runLIUSForLine
 * (the single-line helper) calls it internally. The full 21-line engine is
 * bypassed in production. Exported for potential future use and test coverage.
 */
export async function runLIUSEngine(
  ctx: LIUSEngineContext,
  pool?: Pool,
): Promise<LIUSEngineResult> {
  const start = Date.now();
  const db = pool ?? getPool();
  
  // 1. Load catalog (cached after first load)
  const catalog = loadSchemaCatalog();
  
  // 2. Factor sections to run
  const sections = ctx.sectionFilter ?? Object.keys(catalog.bySection);
  
  // 3. Build source resolver context
  const resolverCtx: SourceResolverContext = {
    dealId: ctx.dealId,
    dealType: ctx.dealType,
    lifecyclePhase: ctx.lifecyclePhase,
    state: ctx.state,
    county: ctx.county,
    units: ctx.units,
    purchasePrice: ctx.purchasePrice,
    totalOpEx: ctx.totalOpEx,
    effectiveGrossIncome: ctx.effectiveGrossIncome,
    brokerAssumptions: ctx.brokerAssumptions,
  };
  
  // 3b. Pre-fetch M35 trajectory signals (W-02: exit cap + absorption wiring).
  // Fetched once per engine run to avoid N×DB round-trips inside the loop.
  // Returns safe defaults (baseline -0.0025, zero drag) when location is absent.
  let m35Signals: M35TrajectorySignals | null = null;
  let m35GrowthRateOverrides: Record<string, number> = {};
  if (ctx.location) {
    m35Signals = await fetchM35TrajectorySignals(ctx.location, ctx.units);
    m35GrowthRateOverrides = toGrowthRateOverrides(m35Signals);
  }

  // CE-16 F3 (W-08): Blend M28 cycle intelligence into exit_cap_trajectory.
  // Requires a real cycle snapshot — no overlay when m28_cycle_snapshots is empty.
  // Uses predictFullChain() per CE-16 F3 spec; cap_change_bps converted to per-year
  // decimal and blended 50/50 with the M35 signal.
  // Non-fatal: any failure leaves m35GrowthRateOverrides untouched.
  if (ctx.marketId) {
    try {
      // Guard: only apply overlay when actual cycle snapshot data exists for this market.
      const cycleSnapshot = await cycleIntelligenceService.getCyclePhase(ctx.marketId);
      if (cycleSnapshot) {
        const fullChain = await cycleIntelligenceService.predictFullChain(ctx.marketId);
        // Convert 12-month cap-rate change bps to a per-year decimal
        // (negative = compression; positive = expansion).
        const m28AnnualRate = fullChain.predictions.cap_change_bps / 10000;
        // The M35 override may already be in the map; fall back to engine baseline.
        const EXIT_CAP_BASELINE = -0.0025;
        const m35Rate = m35GrowthRateOverrides['exit_cap_trajectory'] ?? EXIT_CAP_BASELINE;
        const blendedRate = m35Rate * 0.5 + m28AnnualRate * 0.5;
        // Only write the override when the blended rate differs meaningfully from the baseline.
        if (Math.abs(blendedRate - EXIT_CAP_BASELINE) > 1e-5) {
          m35GrowthRateOverrides = { ...m35GrowthRateOverrides, exit_cap_trajectory: blendedRate };
        }
        logger.debug('[LIUS] M28 cycle cap rate overlay applied', {
          dealId: ctx.dealId,
          marketId: ctx.marketId,
          cyclePhase: cycleSnapshot.lag_phase,
          m28CapChangeBps: fullChain.predictions.cap_change_bps,
          m28AnnualRate,
          m35Rate,
          blendedRate,
        });
      } else {
        logger.debug('[LIUS] M28 cycle overlay skipped — no snapshot data for market', {
          dealId: ctx.dealId,
          marketId: ctx.marketId,
        });
      }
    } catch (m28Err: any) {
      logger.warn('[LIUS] M28 cycle cap rate fetch failed — exit_cap_trajectory uses M35-only signal', {
        dealId: ctx.dealId,
        marketId: ctx.marketId,
        error: m28Err.message,
      });
    }
  }

  // 4. Resolve each section in topological order
  const allEvidences: Evidence[] = [];
  const bySection: Record<string, Evidence[]> = {};
  
  for (const section of sections) {
    const sectionSchemas = (catalog.bySection[section] ?? [])
      .filter(e => e.schema.applicableDealTypes.includes(ctx.dealType));
    
    for (const entry of sectionSchemas) {
      try {
        const schema = entry.schema;
        const result = await resolveLineItem(schema, resolverCtx, db);
        
        // Cross-checks
        const crossChecks: CrossCheck[] = [];
        
        // Collision detection
        const collision = detectCollision(result, resolverCtx, schema);
        
        // Trajectory: project year-by-year values for the hold period.
        // m35GrowthRateOverrides is non-empty only when ctx.location was provided.
        const holdPeriod = ctx.holdPeriodYears ?? 10;

        // For leaseUp.leaseUpAbsorption: inject M35 competing-delivery spike
        // as a pcaEvent so it supersedes the null-value placeholder in the YAML.
        const callerPcaEvents = ctx.pcaEvents?.[schema.liuid] ?? [];
        let effectivePcaEvents = callerPcaEvents;
        if (
          schema.liuid === 'leaseUp.leaseUpAbsorption' &&
          m35Signals !== null &&
          result.posterior.value > 0
        ) {
          const absorptionSpike = buildAbsorptionSpikeEvent(
            m35Signals,
            result.posterior.value,
          );
          if (absorptionSpike !== null) {
            effectivePcaEvents = [...callerPcaEvents, absorptionSpike];
          }
        }

        const trajectoryCtx: TrajectoryContext = {
          holdPeriodYears: holdPeriod,
          lifecycleTimeline: ctx.lifecycleTimeline ?? [],
          profileEvents: ctx.profileEvents?.[schema.liuid],
          pcaEvents: effectivePcaEvents.length > 0 ? effectivePcaEvents : undefined,
          m35GrowthRateOverrides: Object.keys(m35GrowthRateOverrides).length > 0
            ? m35GrowthRateOverrides
            : undefined,
        };
        const yearProjections = projectTrajectory(schema, result.posterior.value, trajectoryCtx);
        
        // Build evidence
        const evidence: Evidence = {
          liuid: schema.liuid,
          schemaVersion: schema.version,
          archetype: schema.archetype,
          posterior: result.posterior,
          source: {
            primaryTier: result.primaryTier,
            primarySource: result.primarySource,
            contributions: result.sources,
          },
          trajectory: {
            events: schema.trajectory?.scheduledEvents ?? [],
            yearProjections,
          },
          crossChecks,
          collision,
          confidence: result.confidence,
          reasoning: '', // Week 4: reasoning templates fill this
          metadata: {
            computedAt: new Date().toISOString(),
            elapsedMs: Date.now() - start,
            schemaFile: entry.filePath,
          },
        };
        
        // Add lifecycle events to evidence
        const lifecycleEvents = generateLifecycleEvents(schema, ctx.lifecycleTimeline ?? []);
        evidence.trajectory.events = [
          ...evidence.trajectory.events,
          ...lifecycleEvents,
        ];
        
        allEvidences.push(evidence);
        if (!bySection[section]) bySection[section] = [];
        bySection[section].push(evidence);
      } catch (err) {
        logger.warn(`[LIUS] Error resolving ${entry.liuid}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  
  // 5. Summary
  const resolved = allEvidences.filter(e => e.posterior.value > 0);
  const summary = {
    totalLines: allEvidences.length,
    resolved: resolved.length,
    confidenceHigh: allEvidences.filter(e => e.confidence.level === 'high').length,
    confidenceMedium: allEvidences.filter(e => e.confidence.level === 'medium').length,
    confidenceLow: allEvidences.filter(e => e.confidence.level === 'low').length,
    collisions: allEvidences.filter(e => e.collision != null).length,
    severeCollisions: allEvidences.filter(e => e.collision?.magnitude === 'severe').length,
  };
  
  return {
    dealId: ctx.dealId,
    version: '0.3',
    evidence: allEvidences,
    bySection,
    summary,
    elapsedMs: Date.now() - start,
  };
}

/**
 * Detect collision between agent-derived value and broker OM assumption.
 */
function detectCollision(
  result: Awaited<ReturnType<typeof resolveLineItem>>,
  ctx: SourceResolverContext,
  schema: LIUSchema,
): CollisionReport | null {
  if (!schema.collision?.enabled) return null;
  if (!ctx.brokerAssumptions) return null;
  
  const key = schema.liuid.split('.').pop()!;
  const brokerValue = ctx.brokerAssumptions[key];
  if (brokerValue == null) return null;
  
  const agentValue = result.posterior.value;
  const deltaPct = agentValue > 0 ? (brokerValue - agentValue) / agentValue : 0;
  const deltaAbs = brokerValue - agentValue;
  
  const materiality = schema.collision.materiality;
  const absMin = materiality?.absoluteMin ?? 0;
  const pctMin = materiality?.pctMin ?? 0;
  
  // Use both abs and pct thresholds
  const absMag = Math.abs(deltaAbs);
  const pctMag = Math.abs(deltaPct);
  
  let magnitude: 'minor' | 'material' | 'severe' = 'minor';
  if (absMag > absMin * 3 || pctMag > 0.5) {
    magnitude = 'severe';
  } else if (absMag > absMin || pctMag > pctMin) {
    magnitude = 'material';
  }
  
  return {
    agentValue,
    brokerValue,
    deltaPct,
    deltaAbs,
    magnitude,
    direction: deltaAbs > 0 ? 'agent_lower' : deltaAbs < 0 ? 'agent_higher' : 'equal',
    narrative: `${schema.label}: agent $${Math.round(agentValue).toLocaleString()} vs broker $${Math.round(brokerValue).toLocaleString()} (${(deltaPct * 100).toFixed(1)}% delta)`,
  };
}

/**
 * Run LIUS for a single line item (useful for Evidence Panel queries).
 */
export async function runLIUSForLine(
  dealId: string,
  liuid: string,
  pool?: Pool,
): Promise<Evidence | null> {
  const catalog = loadSchemaCatalog();
  const entry = catalog.byLiuid[liuid];
  if (!entry) return null;
  
  // Build minimal context (should be enriched by caller)
  const ctx: LIUSEngineContext = {
    dealId,
    dealType: 'acquisition',
    lifecyclePhase: 'stabilized',
    state: '',
    county: null,
    units: null,
    purchasePrice: null,
    totalOpEx: null,
    effectiveGrossIncome: null,
    brokerAssumptions: null,
    sectionFilter: [entry.schema.section],
  };
  
  const result = await runLIUSEngine(ctx, pool);
  return result.evidence.find(e => e.liuid === liuid) ?? null;
}

export default {
  runLIUSEngine,
  runLIUSForLine,
};
