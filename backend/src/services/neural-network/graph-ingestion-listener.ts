/**
 * Graph Ingestion Listener
 * 
 * Listens for entity events and auto-ingests to knowledge graph.
 * Creates nodes and edges automatically when:
 * - Properties are created
 * - Deals are created
 * - Sales are recorded
 * - Permits are issued
 * - Development projects are added
 */

import { Pool } from 'pg';
import { KnowledgeGraphService, getKnowledgeGraph } from './knowledge-graph.service';

export type EntityEventType = 
  | 'property.created' 
  | 'deal.created' 
  | 'sale.recorded' 
  | 'permit.issued' 
  | 'development_project.added'
  | 'market.updated'
  | 'submarket.updated';

export interface EntityEvent {
  type: EntityEventType;
  entityId: string;
  entityType: string;
  data: Record<string, any>;
  timestamp: Date;
  userId?: string;
  source?: string;
}

export class GraphIngestionListener {
  private kg: KnowledgeGraphService;
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
    this.kg = getKnowledgeGraph(pool);
  }

  async handleEvent(event: EntityEvent): Promise<{ success: boolean; nodeId?: string; error?: string }> {
    console.log(`[GraphIngestion] Processing ${event.type} for ${event.entityId}`);

    try {
      let nodeId: string | undefined;

      switch (event.type) {
        case 'property.created':
          nodeId = await this.ingestProperty(event);
          break;
        case 'deal.created':
          nodeId = await this.ingestDeal(event);
          break;
        case 'sale.recorded':
          nodeId = await this.ingestSale(event);
          break;
        case 'permit.issued':
          nodeId = await this.ingestPermit(event);
          break;
        case 'development_project.added':
          nodeId = await this.ingestDevelopmentProject(event);
          break;
        case 'market.updated':
          nodeId = await this.touchMarket(event);
          break;
        case 'submarket.updated':
          nodeId = await this.touchSubmarket(event);
          break;
      }

      return { success: true, nodeId };
    } catch (error: any) {
      console.error(`[GraphIngestion] Error processing ${event.type}:`, error);
      return { success: false, error: error.message };
    }
  }

  private async ingestProperty(event: EntityEvent): Promise<string> {
    const { data } = event;
    
    // Create property node
    const nodeId = await this.kg.upsertNode({
      type: 'Property',
      externalId: event.entityId,
      name: data.name || data.address,
      properties: {
        address: data.address,
        city: data.city,
        state: data.state,
        county: data.county,
        zip: data.zip,
        units: data.units,
        yearBuilt: data.yearBuilt,
        propertyType: data.propertyType || 'multifamily',
        latitude: data.latitude,
        longitude: data.longitude,
        assetClass: data.assetClass,
        owner: data.owner,
      }
    });

    // Create edge to market if known
    if (data.marketId) {
      try {
        const marketNode = await this.kg.findNodeByExternalId('Market', data.marketId);
        if (marketNode) {
          await this.kg.createEdge({
            sourceNodeId: nodeId,
            targetNodeId: marketNode.id,
            edgeType: 'IN_MARKET',
            properties: {}
          });
        }
      } catch (e) {
        // Market node may not exist yet
      }
    }

    // Create edge to submarket if known
    if (data.submarketId) {
      try {
        const subNode = await this.kg.findNodeByExternalId('Submarket', data.submarketId);
        if (subNode) {
          await this.kg.createEdge({
            sourceNodeId: nodeId,
            targetNodeId: subNode.id,
            edgeType: 'IN_SUBMARKET',
            properties: {}
          });
        }
      } catch (e) {
        // Submarket node may not exist yet
      }
    }

    // Create owner edge if known
    if (data.ownerId) {
      try {
        const ownerNode = await this.kg.findNodeByExternalId('Owner', data.ownerId);
        if (ownerNode) {
          await this.kg.createEdge({
            sourceNodeId: ownerNode.id,
            targetNodeId: nodeId,
            edgeType: 'OWNS',
            properties: { since: data.acquisitionDate }
          });
        }
      } catch (e) {
        // Owner node may not exist yet
      }
    }

    return nodeId;
  }

  private async ingestDeal(event: EntityEvent): Promise<string> {
    const { data } = event;
    
    // Create deal node
    const nodeId = await this.kg.upsertNode({
      type: 'Deal',
      externalId: event.entityId,
      name: data.name || `Deal ${event.entityId}`,
      properties: {
        stage: data.stage,
        status: data.status,
        askingPrice: data.askingPrice,
        noi: data.noi,
        capRate: data.capRate,
        units: data.units,
        createdAt: data.createdAt,
        closingDate: data.closingDate,
      }
    });

    // Link to property
    if (data.propertyId) {
      try {
        const propNode = await this.kg.findNodeByExternalId('Property', data.propertyId);
        if (propNode) {
          await this.kg.createEdge({
            sourceNodeId: nodeId,
            targetNodeId: propNode.id,
            edgeType: 'TARGETS',
            properties: { dealStage: data.stage }
          });
        }
      } catch (e) {
        // Property may be inline, not in graph
      }
    }

    return nodeId;
  }

  private async ingestSale(event: EntityEvent): Promise<string> {
    const { data } = event;
    
    const nodeId = await this.kg.upsertNode({
      type: 'Sale',
      externalId: event.entityId,
      name: `Sale: ${data.address || event.entityId}`,
      properties: {
        salePrice: data.salePrice,
        saleDate: data.saleDate,
        pricePerUnit: data.pricePerUnit,
        pricePerSf: data.pricePerSf,
        capRate: data.capRate,
        buyer: data.buyer,
        seller: data.seller,
        units: data.units,
        squareFootage: data.squareFootage,
      }
    });

    // Link to property if we can match
    if (data.propertyId) {
      try {
        const propNode = await this.kg.findNodeByExternalId('Property', data.propertyId);
        if (propNode) {
          await this.kg.createEdge({
            sourceNodeId: nodeId,
            targetNodeId: propNode.id,
            edgeType: 'SALE_OF',
            properties: { saleDate: data.saleDate, salePrice: data.salePrice }
          });
        }
      } catch (e) {}
    }

    // Link to market
    if (data.marketId) {
      try {
        const marketNode = await this.kg.findNodeByExternalId('Market', data.marketId);
        if (marketNode) {
          await this.kg.createEdge({
            sourceNodeId: nodeId,
            targetNodeId: marketNode.id,
            edgeType: 'IN_MARKET',
            properties: {}
          });
        }
      } catch (e) {}
    }

    return nodeId;
  }

  private async ingestPermit(event: EntityEvent): Promise<string> {
    const { data } = event;
    
    const nodeId = await this.kg.upsertNode({
      type: 'Permit',
      externalId: event.entityId,
      name: `Permit: ${data.permitNumber || event.entityId}`,
      properties: {
        permitNumber: data.permitNumber,
        permitType: data.permitType,
        issueDate: data.issueDate,
        estimatedCost: data.estimatedCost,
        description: data.description,
        address: data.address,
        contractor: data.contractor,
        status: data.status,
      }
    });

    // Link to property if matched
    if (data.propertyId) {
      try {
        const propNode = await this.kg.findNodeByExternalId('Property', data.propertyId);
        if (propNode) {
          await this.kg.createEdge({
            sourceNodeId: nodeId,
            targetNodeId: propNode.id,
            edgeType: 'PERMIT_FOR',
            properties: { permitType: data.permitType }
          });
        }
      } catch (e) {}
    }

    return nodeId;
  }

  private async ingestDevelopmentProject(event: EntityEvent): Promise<string> {
    const { data } = event;
    
    const nodeId = await this.kg.upsertNode({
      type: 'Event',
      externalId: event.entityId,
      name: data.name || `Development: ${event.entityId}`,
      properties: {
        eventType: 'development_project',
        units: data.units,
        stories: data.stories,
        developer: data.developer,
        expectedDelivery: data.expectedDelivery,
        constructionStatus: data.constructionStatus,
        assetClass: data.assetClass,
        targetRents: data.targetRents,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
      }
    });

    // Link to market
    if (data.marketId) {
      try {
        const marketNode = await this.kg.findNodeByExternalId('Market', data.marketId);
        if (marketNode) {
          await this.kg.createEdge({
            sourceNodeId: nodeId,
            targetNodeId: marketNode.id,
            edgeType: 'AFFECTS',
            properties: { impactType: 'supply', units: data.units }
          });
        }
      } catch (e) {}
    }

    // Link to submarket
    if (data.submarketId) {
      try {
        const subNode = await this.kg.findNodeByExternalId('Submarket', data.submarketId);
        if (subNode) {
          await this.kg.createEdge({
            sourceNodeId: nodeId,
            targetNodeId: subNode.id,
            edgeType: 'AFFECTS',
            properties: { impactType: 'supply', units: data.units }
          });
        }
      } catch (e) {}
    }

    return nodeId;
  }

  private async touchMarket(event: EntityEvent): Promise<string> {
    const { data } = event;
    
    // Update market node's timestamp
    const result = await this.pool.query(`
      UPDATE knowledge_graph_nodes 
      SET updated_at = NOW(),
          properties = properties || $2::jsonb
      WHERE node_type = 'Market' AND external_id = $1
      RETURNING id
    `, [event.entityId, JSON.stringify(data)]);

    return result.rows[0]?.id;
  }

  private async touchSubmarket(event: EntityEvent): Promise<string> {
    const { data } = event;
    
    const result = await this.pool.query(`
      UPDATE knowledge_graph_nodes 
      SET updated_at = NOW(),
          properties = properties || $2::jsonb
      WHERE node_type = 'Submarket' AND external_id = $1
      RETURNING id
    `, [event.entityId, JSON.stringify(data)]);

    return result.rows[0]?.id;
  }

  // Batch ingest multiple events
  async handleBatch(events: EntityEvent[]): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    for (const event of events) {
      const result = await this.handleEvent(event);
      if (result.success) {
        processed++;
      } else {
        errors++;
      }
    }

    return { processed, errors };
  }
}

// Singleton
let instance: GraphIngestionListener | null = null;

export function getGraphIngestionListener(pool: Pool): GraphIngestionListener {
  if (!instance) {
    instance = new GraphIngestionListener(pool);
  }
  return instance;
}

export default GraphIngestionListener;
