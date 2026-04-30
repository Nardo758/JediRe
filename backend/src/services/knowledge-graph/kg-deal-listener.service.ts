/**
 * KG Deal Listener — Input adapter that pushes deal analysis results into the knowledge graph.
 *
 * Subscribes to deal lifecycle events (zoning analysis complete, market analysis complete,
 * program targets set) and writes structured nodes + edges into the KG.
 *
 * This is the "learn from every deal" feedback loop:
 *   Deal ╶→ Zoning analysis ╶→ ZoningProfile node + IN_MARKET + ZONED_FOR edges
 *   Deal ╶→ Market analysis  ╶→ Market/Submarket enrichment + comp edges
 *   Deal ╶→ Program set      ╶→ ProgramTarget node + edges to amenities, targets
 *
 * NODE TYPES USED:
 *   Deal, ZoningProfile, ProgramTarget, Amenity, Market, Submarket, CompSet
 *
 * EDGE TYPES:
 *   IN_JURISDICTION (Deal → Jurisdiction)
 *   ZONED_AS (Deal → ZoningProfile)
 *   IN_MARKET (Deal → Market)
 *   IN_SUBMARKET (Deal → Submarket)
 *   HAS_TARGET (Deal → ProgramTarget)
 *   HAS_AMENITY (Deal → Amenity)
 *   COMP_OF (Deal → Deal — nearby comparable deals)
 *   ANALYZED_BY (Deal → AgentRun)
 */

import { Pool } from 'pg';
import { KnowledgeGraphService } from '../neural-network/knowledge-graph.service';

// ─── Edge Types ─────────────────────────────────────────────────────────────

type EdgeType =
  | 'IN_JURISDICTION'
  | 'ZONED_AS'
  | 'IN_MARKET'
  | 'IN_SUBMARKET'
  | 'HAS_TARGET'
  | 'HAS_AMENITY'
  | 'COMP_OF'
  | 'SIMILAR_ZONING'
  | 'HAS_COMP'
  | 'ANALYZED_BY';

// ─── Service ────────────────────────────────────────────────────────────────

export class KGDealListener {
  private kg: KnowledgeGraphService;

  constructor(pool: Pool) {
    this.kg = new KnowledgeGraphService(pool);
  }

  // ── Zoning Analysis Completed ──────────────────────────────────────────

  /**
   * Called when a deal's zoning analysis completes.
   * Creates/updates nodes for the zoning profile, jurisdiction, and links them.
   */
  async onZoningAnalysisComplete(params: {
    dealId: string;
    dealName: string;
    jurisdiction: string;
    state: string;
    zoningCode: string;
    zoningProfile: Record<string, any>;
    bindingConstraint: string;
    developmentEnvelope: {
      maxUnits: number;
      maxGfaSf: number;
      maxStories: number;
      maxHeightFt: number;
      buildingFootprintSf: number;
      parkingSpaces: number;
    };
  }): Promise<void> {
    const { dealId, jurisdiction, state, zoningCode, zoningProfile, developmentEnvelope } = params;

    // 1. Upsert Deal node (update properties with zoning findings)
    await this.kg.upsertNode({
      id: `deal-${dealId}`,
      type: 'Deal',
      name: params.dealName,
      externalId: `deal-${dealId}`,
      properties: {
        dealId,
        jurisdiction,
        state,
        zoningCode,
        bindingConstraint: params.bindingConstraint,
        envelope: developmentEnvelope,
      },
    });

    // 2. Upsert Jurisdiction node
    const jurisId = `jurisdiction-${jurisdiction.toLowerCase().replace(/\s+/g, '-')}-${state.toLowerCase()}`;
    await this.kg.upsertNode({
      id: jurisId,
      type: 'Market',
      name: `${jurisdiction}, ${state}`,
      externalId: jurisId,
      properties: { jurisdiction, state, type: 'jurisdiction' },
    });

    await this.kg.createEdge({
      source_id: `deal-${dealId}`,
      target_id: jurisId,
      type: 'IN_JURISDICTION',
      properties: { binding_constraint: params.bindingConstraint },
    });

    // 3. Upsert ZoningProfile node
    const zoneId = `zoning-${zoningCode.toLowerCase()}-${jurisdiction.toLowerCase().replace(/\s+/g, '-')}`;
    await this.kg.upsertNode({
      id: zoneId,
      type: 'ZoningProfile',
      name: `Zone ${zoningCode} — ${jurisdiction}`,
      externalId: zoneId,
      properties: {
        zoningCode,
        jurisdiction,
        state,
        dimensional: zoningProfile.dimensional || {},
        parking: zoningProfile.parking || {},
        uses: zoningProfile.uses || {},
        incentives: zoningProfile.incentives || [],
      },
    });

    await this.kg.createEdge({
      source_id: `deal-${dealId}`,
      target_id: zoneId,
      type: 'ZONED_AS',
      properties: { binding_constraint: params.bindingConstraint },
    });

    // 4. Check for similar zoning profiles from other deals in the same jurisdiction
    await this._linkSimilarZoning(zoneId, jurisdiction, zoningCode);
  }

  // ── Market Analysis Completed ───────────────────────────────────────────

  /**
   * Called when a deal's market analysis completes.
   * Links the deal to its market, submarket, and comparable deals.
   */
  async onMarketAnalysisComplete(params: {
    dealId: string;
    market: string;
    submarket: string;
    msa: string;
    region: string;
    compDealIds?: string[];
    marketStats?: Record<string, any>;
    submarketStats?: Record<string, any>;
  }): Promise<void> {
    const { dealId, market, submarket, msa, region } = params;

    // 1. Upsert Market node
    const marketId = `market-${msa.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    await this.kg.upsertNode({
      id: marketId,
      type: 'Market',
      name: market,
      externalId: marketId,
      properties: { msa, region, stats: params.marketStats || {} },
    });

    await this.kg.createEdge({
      source_id: `deal-${dealId}`,
      target_id: marketId,
      type: 'IN_MARKET',
      properties: { msa },
    });

    // 2. Upsert Submarket node
    const submarketId = `submarket-${submarket.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    await this.kg.upsertNode({
      id: submarketId,
      type: 'Submarket',
      name: submarket,
      externalId: submarketId,
      properties: { market: msa, stats: params.submarketStats || {} },
    });

    await this.kg.createEdge({
      source_id: `deal-${dealId}`,
      target_id: submarketId,
      type: 'IN_SUBMARKET',
      properties: {},
    });

    // 3. Link to comparable deals
    if (params.compDealIds?.length) {
      for (const compId of params.compDealIds) {
        await this.kg.createEdge({
          source_id: `deal-${dealId}`,
          target_id: `deal-${compId}`,
          type: 'COMP_OF',
          properties: {},
        });
      }
    }
  }

  // ── Program Targets Set ────────────────────────────────────────────────

  /**
   * Called when F3 Programming tab saves program targets.
   * Creates ProgramTarget + Amenity nodes linked to the deal.
   */
  async onProgramTargetsSet(params: {
    dealId: string;
    targetUnits: number;
    targetGFA: number;
    targetFAR: number;
    targetFloors: number;
    targetHeight: number;
    parkingRatio: number;
    unitMix?: { studio: number; oneBed: number; twoBed: number; threeBed: number };
    amenities?: { id: string; name: string; category: string; estimatedCost?: number }[];
    budget?: { total: number; costPerSqft: number };
  }): Promise<void> {
    const { dealId } = params;

    // 1. Upsert ProgramTarget node linked to deal
    const targetId = `program-target-${dealId}`;
    await this.kg.upsertNode({
      id: targetId,
      type: 'ProgramTarget',
      name: `Program ${params.targetUnits}u / ${Math.round(params.targetGFA / 1000)}K GFA`,
      externalId: targetId,
      properties: {
        dealId,
        targetUnits: params.targetUnits,
        targetGFA: params.targetGFA,
        targetFAR: params.targetFAR,
        targetFloors: params.targetFloors,
        targetHeight: params.targetHeight,
        parkingRatio: params.parkingRatio,
        unitMix: params.unitMix,
        budget: params.budget,
      },
    });

    await this.kg.createEdge({
      source_id: `deal-${dealId}`,
      target_id: targetId,
      type: 'HAS_TARGET',
      properties: {},
    });

    // 2. Create Amenity nodes + edges for each approved amenity
    if (params.amenities?.length) {
      for (const amenity of params.amenities) {
        const amId = `amenity-${amenity.id}`;
        await this.kg.upsertNode({
          id: amId,
          type: 'AmenityFeature',
          name: amenity.name,
          externalId: amId,
          properties: {
            category: amenity.category,
            estimatedCost: amenity.estimatedCost,
          },
        });

        await this.kg.createEdge({
          source_id: `deal-${dealId}`,
          target_id: amId,
          type: 'HAS_AMENITY',
          properties: { cost: amenity.estimatedCost },
        });
      }
    }
  }

  // ── Agent Run Completed ────────────────────────────────────────────────

  /**
   * Called when any agent completes a run against the deal.
   * Links the agent run to the deal for traceability.
   */
  async onAgentRunComplete(params: {
    dealId: string;
    agentName: string;
    runId: string;
    summary: string;
    keyFindings?: string[];
  }): Promise<void> {
    const runId = `agent-run-${params.runId}`;
    await this.kg.upsertNode({
      id: runId,
      type: 'Agent',
      name: `${params.agentName} — ${params.summary.slice(0, 80)}`,
      externalId: runId,
      properties: {
        agentName: params.agentName,
        runId: params.runId,
        summary: params.summary,
        keyFindings: params.keyFindings || [],
      },
    });

    await this.kg.createEdge({
      source_id: `deal-${params.dealId}`,
      target_id: runId,
      type: 'ANALYZED_BY',
      properties: { agentName: params.agentName },
    });
  }

  // ── Private: link similar zoning profiles ──────────────────────────────

  private async _linkSimilarZoning(
    zoneId: string,
    jurisdiction: string,
    zoningCode: string,
  ): Promise<void> {
    try {
      // Find other zoning nodes in the same jurisdiction with similar codes
      const result = await this.kg.getNodesByType('ZoningProfile', 50);

      const similar = result.filter(
        (n) =>
          n.id !== zoneId &&
          n.properties?.jurisdiction === jurisdiction &&
          n.properties?.zoningCode?.toString().toLowerCase().includes(
            zoningCode.slice(0, 2).toLowerCase(),
          ),
      );

      for (const node of similar) {
        await this.kg.createEdge({
          source_id: zoneId,
          target_id: node.id,
          type: 'SIMILAR_ZONING',
          properties: { jurisdiction, baseCode: zoningCode.slice(0, 2) },
        });
      }
    } catch {
      // Best-effort — linking similar zones is non-critical
    }
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

let instance: KGDealListener | null = null;

export function getKGDealListener(pool?: Pool): KGDealListener {
  if (!instance && pool) {
    instance = new KGDealListener(pool);
  }
  return instance!;
}

export default KGDealListener;
