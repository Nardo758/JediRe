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
            yearProjections: [], // Week 2: trajectory engine fills this
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
