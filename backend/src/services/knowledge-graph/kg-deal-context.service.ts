/**
 * KG Deal Context Service — Output adapter.
 *
 * Queries the knowledge graph to surface context about a deal, a market,
 * or a zoning profile. Returns structured data ready for F-tab frontend panels.
 *
 * MAIN QUERIES:
 *   getDealContext(dealId)  → Full context panel for a specific deal
 *   searchSimilarDeals(opts)→ Deals in same market + similar zoning
 *   getMarketInsights(msa) → Market-wide stats and active deal comparisons
 *   getZoningPrecedents(code, jurisdiction) → What similar zones yield
 */

import { Pool } from 'pg';
import { KnowledgeGraphService } from '../neural-network/knowledge-graph.service';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DealContext {
  dealId: string;
  name: string;
  jurisdiction: string;
  zoneCode: string;
  envelope?: Record<string, any>;
  similarDeals: Array<{
    dealId: string;
    name: string;
    zoningCode: string;
    envelope: Record<string, any> | null;
    market: string;
  }>;
  zoningPrecedents: Array<{
    zoneCode: string;
    jurisdiction: string;
    dimensional: Record<string, any>;
    parking: Record<string, any>;
    count: number;
  }>;
  marketInsights: {
    market: string;
    dealCount: number;
    avgEnvelope: Record<string, number> | null;
  } | null;
}

export interface SimilarDealSearchOpts {
  jurisdiction?: string;
  zoneCode?: string;
  market?: string;
  limit?: number;
}

export interface SimilarDealResult {
  dealId: string;
  name: string;
  zoningCode: string;
  jurisdiction: string;
  market: string;
  envelope: Record<string, any> | null;
  similarity: 'exact_zone' | 'same_jurisdiction' | 'same_market' | 'similar_zone';
}

export interface MarketInsight {
  msa: string;
  name: string;
  region: string;
  dealCount: number;
  activeDeals: Array<{ dealId: string; name: string; zoneCode: string; units: number | null }>;
  avgEnvelope: {
    avgUnits: number;
    avgGfaSf: number;
    avgFloors: number;
    avgFAR: number | null;
  } | null;
}

export interface ZoningPrecedent {
  zoneCode: string;
  jurisdiction: string;
  dimensional: Record<string, any>;
  parking: Record<string, any>;
  dealCount: number;
  dealIds: string[];
  avgEnvelope: {
    avgUnits: number;
    avgGfaSf: number;
    avgHeightFt: number;
  } | null;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class KGDealContextService {
  private kg: KnowledgeGraphService;

  constructor(pool: Pool) {
    this.kg = new KnowledgeGraphService(pool);
  }

  /**
   * Full context panel for a deal: similar deals, zoning precedents, market.
   */
  async getDealContext(dealId: string): Promise<DealContext | null> {
    const dealNode = await this.kg.findNodeByExternalId('Deal', `deal-${dealId}`);
    if (!dealNode) return null;

    const props = dealNode.properties || {};

    // Parallel fetch
    const [similarDeals, zoningPrecedents, marketInsights] = await Promise.all([
      this.searchSimilarDeals({
        jurisdiction: props.jurisdiction,
        zoneCode: props.zoningCode,
        market: props.market,
        limit: 10,
      }),
      this.getZoningPrecedents(props.zoningCode, props.jurisdiction),
      props.msa ? this.getMarketInsights(props.msa) : Promise.resolve(null),
    ]);

    return {
      dealId,
      name: dealNode.name,
      jurisdiction: props.jurisdiction || '',
      zoneCode: props.zoningCode || '',
      envelope: props.envelope || null,
      similarDeals: similarDeals
        .filter((d) => d.dealId !== dealId)
        .slice(0, 10),
      zoningPrecedents: zoningPrecedents.slice(0, 5),
      marketInsights,
    };
  }

  /**
   * Search for deals similar to the given criteria.
   */
  async searchSimilarDeals(
    opts: SimilarDealSearchOpts,
    excludeDealId?: string,
  ): Promise<SimilarDealResult[]> {
    const results: SimilarDealResult[] = [];
    const seen = new Set<string>();

    // 1. Exact zone match (strongest signal)
    if (opts.zoneCode && opts.jurisdiction) {
      const zoneId = `zoning-${opts.zoneCode.toLowerCase()}-${opts.jurisdiction.toLowerCase().replace(/\s+/g, '-')}`;
      const edges = await this.kg.getEdges(zoneId, 'incoming', ['ZONED_AS'] as any);
      for (const e of edges) {
        const dealNode = await this.kg.getNode(e.source_id);
        if (dealNode && !seen.has(dealNode.id)) {
          seen.add(dealNode.id);
          const p = dealNode.properties || {};
          results.push({
            dealId: p.dealId || dealNode.id.replace('deal-', ''),
            name: dealNode.name,
            zoningCode: p.zoningCode || opts.zoneCode,
            jurisdiction: p.jurisdiction || opts.jurisdiction,
            market: p.market || opts.market || '',
            envelope: p.envelope || null,
            similarity: 'exact_zone',
          });
        }
      }
    }

    // 2. Same jurisdiction, similar zone prefix
    if (opts.jurisdiction && opts.zoneCode) {
      const zoneNodes = await this.kg.getNodesByType('ZoningProfile', 200);
      const similarZoneNodes = zoneNodes.filter(
        (n) =>
          n.properties?.jurisdiction === opts.jurisdiction &&
          n.properties?.zoningCode?.toString().slice(0, 2) === opts.zoneCode.slice(0, 2) &&
          n.properties?.zoningCode !== opts.zoneCode,
      );
      for (const zn of similarZoneNodes) {
        const edges = await this.kg.getEdges(zn.id, 'incoming', ['ZONED_AS'] as any);
        for (const e of edges.slice(0, 3)) {
          const dealNode = await this.kg.getNode(e.source_id);
          if (dealNode && !seen.has(dealNode.id)) {
            seen.add(dealNode.id);
            const p = dealNode.properties || {};
            results.push({
              dealId: p.dealId || dealNode.id.replace('deal-', ''),
              name: dealNode.name,
              zoningCode: p.zoningCode || zn.properties?.zoningCode,
              jurisdiction: p.jurisdiction || opts.jurisdiction,
              market: p.market || opts.market || '',
              envelope: p.envelope || null,
              similarity: 'similar_zone',
            });
          }
        }
      }
    }

    // 3. Same jurisdiction (fallback)
    if (opts.jurisdiction) {
      const dealNodes = await this.kg.getNodesByType('Deal', 200);
      for (const dn of dealNodes) {
        const p = dn.properties || {};
        if (
          p.jurisdiction === opts.jurisdiction &&
          !seen.has(dn.id) &&
          (excludeDealId ? p.dealId !== excludeDealId : true)
        ) {
          seen.add(dn.id);
          results.push({
            dealId: p.dealId || dn.id.replace('deal-', ''),
            name: dn.name,
            zoningCode: p.zoningCode || '',
            jurisdiction: p.jurisdiction,
            market: p.market || opts.market || '',
            envelope: p.envelope || null,
            similarity: 'same_jurisdiction',
          });
        }
      }
    }

    // 4. Same market (broadest)
    if (opts.market) {
      const marketId = `market-${opts.market.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const edges = await this.kg.getEdges(marketId, 'incoming', ['IN_MARKET'] as any);
      for (const e of edges) {
        const dealNode = await this.kg.getNode(e.source_id);
        if (dealNode && !seen.has(dealNode.id)) {
          seen.add(dealNode.id);
          const p = dealNode.properties || {};
          results.push({
            dealId: p.dealId || dealNode.id.replace('deal-', ''),
            name: dealNode.name,
            zoningCode: p.zoningCode || '',
            jurisdiction: p.jurisdiction || opts.jurisdiction || '',
            market: p.market || opts.market,
            envelope: p.envelope || null,
            similarity: 'same_market',
          });
        }
      }
    }

    return results.slice(0, opts.limit || 20);
  }

  /**
   * Market-level insights: average development envelope, active deals.
   */
  async getMarketInsights(msa: string): Promise<MarketInsight | null> {
    const marketId = `market-${msa.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const marketNode = await this.kg.getNode(marketId);
    if (!marketNode) return null;

    const mktProps = marketNode.properties || {};

    const edges = await this.kg.getEdges(marketId, 'incoming', ['IN_MARKET'] as any);

    const activeDeals: MarketInsight['activeDeals'] = [];
    const envelopeAccum = { units: 0, gfaSf: 0, floors: 0, far: 0, count: 0 };

    for (const e of edges) {
      const dealNode = await this.kg.getNode(e.source_id);
      if (!dealNode) continue;
      const p = dealNode.properties || {};
      const env = p.envelope;
      activeDeals.push({
        dealId: p.dealId || dealNode.id.replace('deal-', ''),
        name: dealNode.name,
        zoneCode: p.zoningCode || '',
        units: env?.maxUnits ?? null,
      });
      if (env?.maxUnits) {
        envelopeAccum.units += env.maxUnits;
        envelopeAccum.gfaSf += env.maxGfaSf || 0;
        envelopeAccum.floors += env.maxStories || 0;
        envelopeAccum.far += env.maxFAR || 0;
        envelopeAccum.count++;
      }
    }

    const avgEnvelope = envelopeAccum.count > 0
      ? {
          avgUnits: Math.round(envelopeAccum.units / envelopeAccum.count),
          avgGfaSf: Math.round(envelopeAccum.gfaSf / envelopeAccum.count),
          avgFloors: Math.round((envelopeAccum.floors / envelopeAccum.count) * 10) / 10,
          avgFAR: envelopeAccum.far > 0
            ? Math.round((envelopeAccum.far / envelopeAccum.count) * 100) / 100
            : null,
        }
      : null;

    return {
      msa,
      name: marketNode.name,
      region: mktProps.region || '',
      dealCount: activeDeals.length,
      activeDeals,
      avgEnvelope,
    };
  }

  /**
   * Zoning precedents: what have similar zones yielded in this jurisdiction?
   */
  async getZoningPrecedents(
    zoneCode: string,
    jurisdiction: string,
  ): Promise<ZoningPrecedent[]> {
    const zoneId = `zoning-${zoneCode.toLowerCase()}-${jurisdiction.toLowerCase().replace(/\s+/g, '-')}`;

    // Get the specific zone profile
    const targetZone = await this.kg.getNode(zoneId);
    if (!targetZone) return [];

    // Find deals zoned under this profile
    const edges = await this.kg.getEdges(zoneId, 'incoming', ['ZONED_AS'] as any);
    const zp = targetZone.properties || {};

    const dealIds: string[] = [];
    const envAccum = { units: 0, gfaSf: 0, heightFt: 0, count: 0 };

    for (const e of edges) {
      const dn = await this.kg.getNode(e.source_id);
      if (!dn) continue;
      const p = dn.properties || {};
      dealIds.push(p.dealId || dn.id.replace('deal-', ''));
      const env = p.envelope;
      if (env?.maxUnits) {
        envAccum.units += env.maxUnits;
        envAccum.gfaSf += env.maxGfaSf || 0;
        envAccum.heightFt += env.maxHeightFt || 0;
        envAccum.count++;
      }
    }

    const avgEnvelope = envAccum.count > 0
      ? {
          avgUnits: Math.round(envAccum.units / envAccum.count),
          avgGfaSf: Math.round(envAccum.gfaSf / envAccum.count),
          avgHeightFt: Math.round((envAccum.heightFt / envAccum.count) * 10) / 10,
        }
      : null;

    return [
      {
        zoneCode: zp.zoningCode || zoneCode,
        jurisdiction: zp.jurisdiction || jurisdiction,
        dimensional: zp.dimensional || {},
        parking: zp.parking || {},
        dealCount: dealIds.length,
        dealIds,
        avgEnvelope,
      },
    ];
  }

  /**
   * Semantic search across all KG nodes (deal summaries, zoning profiles, markets).
   */
  async semanticSearch(query: string, limit = 10): Promise<any[]> {
    return this.kg.hybridSearch({
      query,
      limit,
      includeEdges: false,
    });
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

let instance: KGDealContextService | null = null;

export function getKGDealContextService(pool?: Pool): KGDealContextService {
  if (!instance && pool) {
    instance = new KGDealContextService(pool);
  }
  return instance!;
}
