# DeepSeek Execution Tasks

These are self-contained tasks for DeepSeek to execute. Each task has clear inputs, outputs, and file locations.

---

## Task 1: Create SupplyMetricCell Wrapper for F4MarketsView

**Goal:** Create a thin wrapper that integrates SmartMetricCell into the existing F4 table structure.

**File:** `frontend/src/components/terminal/cells/SupplyCell.tsx` (NEW)

**Input:**
```typescript
// Current pipeline column in F4MarketsView renders like this:
<ThresholdVal value={m.pipeline} thresholds={[8, 14]} invert />
// Where m.pipeline is "15.8%" and m.pipelineNum is 15.8
```

**Output:**
```typescript
import React from 'react';
import { SmartMetricCell } from '../../intelligence/SmartMetricCell';

interface SupplyCellProps {
  value: string;       // "15.8%"
  valueNum: number;    // 15.8
  marketId: string;    // "atlanta-ga"
  submarketId?: string;
}

export const SupplyCell: React.FC<SupplyCellProps> = ({ 
  value, 
  valueNum, 
  marketId,
  submarketId 
}) => {
  // Color based on threshold (lower is better for pipeline)
  const color = valueNum <= 8 ? '#10B981' : valueNum <= 14 ? '#F59E0B' : '#EF4444';
  
  return (
    <SmartMetricCell
      value={valueNum}
      metricType="supply"
      format="percent"
      marketId={marketId}
      submarketId={submarketId}
      className=""
      expandable={true}
    />
  );
};

export default SupplyCell;
```

---

## Task 2: Create Graph Ingestion Listener

**Goal:** Create event-driven service that auto-ingests entities to knowledge graph.

**File:** `backend/src/services/neural-network/graph-ingestion-listener.ts` (NEW)

**Input:** Event types that should trigger graph ingestion:
- property.created
- deal.created  
- sale.recorded
- permit.issued
- development_project.added

**Output:**
```typescript
/**
 * Graph Ingestion Listener
 * 
 * Listens for entity events and auto-ingests to knowledge graph.
 * Creates nodes and edges automatically.
 */

import { Pool } from 'pg';
import { KnowledgeGraphService, getKnowledgeGraph } from './knowledge-graph.service';

export interface EntityEvent {
  type: 'property.created' | 'deal.created' | 'sale.recorded' | 'permit.issued' | 'development_project.added';
  entityId: string;
  entityType: string;
  data: Record<string, any>;
  timestamp: Date;
  userId?: string;
}

export class GraphIngestionListener {
  private kg: KnowledgeGraphService;
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
    this.kg = getKnowledgeGraph(pool);
  }

  async handleEvent(event: EntityEvent): Promise<void> {
    console.log(`[GraphIngestion] Processing ${event.type} for ${event.entityId}`);

    try {
      switch (event.type) {
        case 'property.created':
          await this.ingestProperty(event);
          break;
        case 'deal.created':
          await this.ingestDeal(event);
          break;
        case 'sale.recorded':
          await this.ingestSale(event);
          break;
        case 'permit.issued':
          await this.ingestPermit(event);
          break;
        case 'development_project.added':
          await this.ingestDevelopmentProject(event);
          break;
      }
    } catch (error) {
      console.error(`[GraphIngestion] Error processing ${event.type}:`, error);
    }
  }

  private async ingestProperty(event: EntityEvent): Promise<void> {
    const { data } = event;
    
    // Create property node
    await this.kg.upsertNode({
      type: 'Property',
      externalId: event.entityId,
      name: data.name || data.address,
      properties: {
        address: data.address,
        city: data.city,
        state: data.state,
        units: data.units,
        yearBuilt: data.yearBuilt,
        propertyType: data.propertyType,
        latitude: data.latitude,
        longitude: data.longitude,
      }
    });

    // Create edge to market if known
    if (data.marketId) {
      const marketNode = await this.kg.findNodeByExternalId('Market', data.marketId);
      if (marketNode) {
        await this.kg.createEdge({
          sourceNodeId: event.entityId,
          targetNodeId: marketNode.id,
          edgeType: 'IN_MARKET',
          properties: {}
        });
      }
    }

    // Create edge to submarket if known
    if (data.submarketId) {
      const subNode = await this.kg.findNodeByExternalId('Submarket', data.submarketId);
      if (subNode) {
        await this.kg.createEdge({
          sourceNodeId: event.entityId,
          targetNodeId: subNode.id,
          edgeType: 'IN_SUBMARKET',
          properties: {}
        });
      }
    }
  }

  private async ingestDeal(event: EntityEvent): Promise<void> {
    const { data } = event;
    
    // Create deal node
    await this.kg.upsertNode({
      type: 'Deal',
      externalId: event.entityId,
      name: data.name || `Deal ${event.entityId}`,
      properties: {
        stage: data.stage,
        askingPrice: data.askingPrice,
        noi: data.noi,
        capRate: data.capRate,
        status: data.status,
      }
    });

    // Link to property
    if (data.propertyId) {
      await this.kg.createEdge({
        sourceNodeId: event.entityId,
        targetNodeId: data.propertyId,
        edgeType: 'TARGETS',
        properties: { dealStage: data.stage }
      });
    }
  }

  private async ingestSale(event: EntityEvent): Promise<void> {
    const { data } = event;
    
    await this.kg.upsertNode({
      type: 'Sale',
      externalId: event.entityId,
      name: `Sale: ${data.address || event.entityId}`,
      properties: {
        salePrice: data.salePrice,
        saleDate: data.saleDate,
        pricePerUnit: data.pricePerUnit,
        capRate: data.capRate,
        buyer: data.buyer,
        seller: data.seller,
      }
    });

    // Link to property
    if (data.propertyId) {
      await this.kg.createEdge({
        sourceNodeId: event.entityId,
        targetNodeId: data.propertyId,
        edgeType: 'SALE_OF',
        properties: { saleDate: data.saleDate }
      });
    }
  }

  private async ingestPermit(event: EntityEvent): Promise<void> {
    const { data } = event;
    
    await this.kg.upsertNode({
      type: 'Permit',
      externalId: event.entityId,
      name: `Permit: ${data.permitNumber || event.entityId}`,
      properties: {
        permitNumber: data.permitNumber,
        permitType: data.permitType,
        issueDate: data.issueDate,
        estimatedCost: data.estimatedCost,
        description: data.description,
      }
    });
  }

  private async ingestDevelopmentProject(event: EntityEvent): Promise<void> {
    const { data } = event;
    
    await this.kg.upsertNode({
      type: 'Event',
      externalId: event.entityId,
      name: data.name || `Development: ${event.entityId}`,
      properties: {
        eventType: 'development_project',
        units: data.units,
        developer: data.developer,
        expectedDelivery: data.expectedDelivery,
        constructionStatus: data.constructionStatus,
        assetClass: data.assetClass,
      }
    });

    // Link to market/submarket
    if (data.marketId) {
      const marketNode = await this.kg.findNodeByExternalId('Market', data.marketId);
      if (marketNode) {
        await this.kg.createEdge({
          sourceNodeId: event.entityId,
          targetNodeId: marketNode.id,
          edgeType: 'AFFECTS',
          properties: { impactType: 'supply' }
        });
      }
    }
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
```

---

## Task 3: Create Scheduled Refresh Service

**Goal:** Cron service that checks for stale nodes and queues refresh tasks.

**File:** `backend/src/services/neural-network/scheduled-refresh.ts` (NEW)

**Output:**
```typescript
/**
 * Scheduled Refresh Service
 * 
 * Periodically checks for stale knowledge graph nodes and triggers refreshes.
 * Runs via cron every 6 hours.
 */

import { Pool } from 'pg';
import { getKnowledgeGraph, KnowledgeGraphService } from './knowledge-graph.service';
import { inngest } from '../../lib/inngest';

export interface RefreshTask {
  nodeId: string;
  nodeType: string;
  externalId: string;
  priority: 'high' | 'medium' | 'low';
  lastUpdated: Date;
  staleDays: number;
}

export class ScheduledRefreshService {
  private kg: KnowledgeGraphService;
  private pool: Pool;

  // Staleness thresholds by node type (in days)
  private static STALENESS_THRESHOLDS: Record<string, number> = {
    Property: 30,
    Market: 7,
    Submarket: 7,
    Event: 14,
    Metric: 1,
    Sale: 90,
    Permit: 30,
  };

  constructor(pool: Pool) {
    this.pool = pool;
    this.kg = getKnowledgeGraph(pool);
  }

  async getStaleNodes(limit = 100): Promise<RefreshTask[]> {
    const query = `
      SELECT 
        id,
        node_type,
        external_id,
        updated_at,
        EXTRACT(DAY FROM NOW() - updated_at) as stale_days
      FROM knowledge_graph_nodes
      WHERE 
        (node_type = 'Property' AND updated_at < NOW() - INTERVAL '30 days') OR
        (node_type = 'Market' AND updated_at < NOW() - INTERVAL '7 days') OR
        (node_type = 'Submarket' AND updated_at < NOW() - INTERVAL '7 days') OR
        (node_type = 'Event' AND updated_at < NOW() - INTERVAL '14 days') OR
        (node_type = 'Metric' AND updated_at < NOW() - INTERVAL '1 day')
      ORDER BY 
        CASE node_type 
          WHEN 'Metric' THEN 1
          WHEN 'Market' THEN 2
          WHEN 'Submarket' THEN 3
          WHEN 'Property' THEN 4
          ELSE 5
        END,
        updated_at ASC
      LIMIT $1
    `;

    const result = await this.pool.query(query, [limit]);

    return result.rows.map(row => ({
      nodeId: row.id,
      nodeType: row.node_type,
      externalId: row.external_id,
      priority: this.determinePriority(row.node_type, row.stale_days),
      lastUpdated: row.updated_at,
      staleDays: Math.round(row.stale_days),
    }));
  }

  private determinePriority(nodeType: string, staleDays: number): 'high' | 'medium' | 'low' {
    const threshold = ScheduledRefreshService.STALENESS_THRESHOLDS[nodeType] || 30;
    const ratio = staleDays / threshold;

    if (ratio >= 3) return 'high';
    if (ratio >= 2) return 'medium';
    return 'low';
  }

  async queueRefreshTasks(tasks: RefreshTask[]): Promise<number> {
    let queued = 0;

    // Group by node type for efficient batching
    const byType: Record<string, RefreshTask[]> = {};
    for (const task of tasks) {
      if (!byType[task.nodeType]) byType[task.nodeType] = [];
      byType[task.nodeType].push(task);
    }

    // Queue agent tasks based on type
    for (const [nodeType, typeTasks] of Object.entries(byType)) {
      const agentType = this.getAgentForNodeType(nodeType);
      if (!agentType) continue;

      // Send to Inngest
      await inngest.send({
        name: 'agent/scheduled-refresh',
        data: {
          agentType,
          nodeType,
          tasks: typeTasks.map(t => ({
            nodeId: t.nodeId,
            externalId: t.externalId,
            priority: t.priority,
          })),
        },
      });

      queued += typeTasks.length;
    }

    console.log(`[ScheduledRefresh] Queued ${queued} refresh tasks`);
    return queued;
  }

  private getAgentForNodeType(nodeType: string): string | null {
    const mapping: Record<string, string> = {
      Property: 'research',
      Market: 'research',
      Submarket: 'research',
      Event: 'supply',
      Metric: 'research',
    };
    return mapping[nodeType] || null;
  }

  async run(): Promise<{ stale: number; queued: number }> {
    console.log('[ScheduledRefresh] Starting scheduled refresh check...');

    const staleTasks = await this.getStaleNodes(100);
    console.log(`[ScheduledRefresh] Found ${staleTasks.length} stale nodes`);

    if (staleTasks.length === 0) {
      return { stale: 0, queued: 0 };
    }

    const queued = await this.queueRefreshTasks(staleTasks);

    return { stale: staleTasks.length, queued };
  }
}

// Singleton
let instance: ScheduledRefreshService | null = null;

export function getScheduledRefreshService(pool: Pool): ScheduledRefreshService {
  if (!instance) {
    instance = new ScheduledRefreshService(pool);
  }
  return instance;
}

export default ScheduledRefreshService;
```

---

## Task 4: Create Embeddings Service Stub

**Goal:** Create embeddings service for future semantic search.

**File:** `backend/src/services/neural-network/embeddings.service.ts` (NEW)

**Output:**
```typescript
/**
 * Embeddings Service
 * 
 * Generates and caches embeddings for knowledge graph nodes.
 * Uses OpenAI ada-002 or local model.
 */

import { Pool } from 'pg';

export interface EmbeddingResult {
  nodeId: string;
  embedding: number[];
  model: string;
  dimensions: number;
}

export class EmbeddingsService {
  private pool: Pool;
  private model = 'text-embedding-ada-002';
  private dimensions = 1536;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // TODO: Implement actual embedding generation
    // For now, return placeholder
    console.log(`[Embeddings] Would generate embedding for: ${text.substring(0, 50)}...`);
    
    // Placeholder: return zero vector
    return new Array(this.dimensions).fill(0);
  }

  async batchGenerate(texts: string[]): Promise<number[][]> {
    // TODO: Implement batch embedding
    return texts.map(() => new Array(this.dimensions).fill(0));
  }

  async cacheEmbedding(nodeId: string, embedding: number[]): Promise<void> {
    const query = `
      INSERT INTO kg_embeddings_cache (node_id, embedding, model, dimensions, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (node_id) DO UPDATE SET
        embedding = EXCLUDED.embedding,
        model = EXCLUDED.model,
        updated_at = NOW()
    `;

    await this.pool.query(query, [
      nodeId,
      JSON.stringify(embedding),
      this.model,
      this.dimensions,
    ]);
  }

  async getEmbedding(nodeId: string): Promise<number[] | null> {
    const query = `
      SELECT embedding FROM kg_embeddings_cache WHERE node_id = $1
    `;

    const result = await this.pool.query(query, [nodeId]);
    if (result.rows.length === 0) return null;

    return JSON.parse(result.rows[0].embedding);
  }

  async similaritySearch(
    queryEmbedding: number[],
    limit = 10,
    nodeTypes?: string[]
  ): Promise<Array<{ nodeId: string; similarity: number }>> {
    // TODO: Implement actual vector similarity search using pgvector
    // For now, return empty results
    console.log(`[Embeddings] Would search for similar nodes (limit: ${limit})`);
    return [];
  }
}

// Singleton
let instance: EmbeddingsService | null = null;

export function getEmbeddingsService(pool: Pool): EmbeddingsService {
  if (!instance) {
    instance = new EmbeddingsService(pool);
  }
  return instance;
}

export default EmbeddingsService;
```

---

## Task 5: Update Neural Network Index

**Goal:** Export all neural network services from index.

**File:** `backend/src/services/neural-network/index.ts` (UPDATE)

**Current content to append:**
```typescript
// Add these exports to existing index.ts

export { GraphIngestionListener, getGraphIngestionListener } from './graph-ingestion-listener';
export { ScheduledRefreshService, getScheduledRefreshService } from './scheduled-refresh';
export { EmbeddingsService, getEmbeddingsService } from './embeddings.service';
```

---

## Task 6: Wire Research Agent to Graph

**Goal:** After research agent completes, update knowledge graph.

**File:** `backend/src/agents/research.inngest.ts` (UPDATE)

**Add at end of successful research run:**
```typescript
// After successful research, update knowledge graph
import { getGraphIngestionListener } from '../services/neural-network/graph-ingestion-listener';

// In the research agent completion handler:
const graphListener = getGraphIngestionListener(pool);

if (researchResult.properties?.length > 0) {
  for (const prop of researchResult.properties) {
    await graphListener.handleEvent({
      type: 'property.created',
      entityId: prop.id,
      entityType: 'Property',
      data: prop,
      timestamp: new Date(),
    });
  }
}

if (researchResult.marketInsights) {
  // Update market node staleness
  await pool.query(`
    UPDATE knowledge_graph_nodes 
    SET updated_at = NOW() 
    WHERE node_type = 'Market' AND external_id = $1
  `, [researchResult.marketId]);
}
```

---

## Execution Instructions

Run each task through the planner-executor:

```bash
curl -X POST http://localhost:3000/api/v1/planner/execute \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Create the SupplyCell wrapper component",
    "context": { "taskNumber": 1 },
    "maxSteps": 3
  }'
```

Or batch all tasks:

```bash
curl -X POST http://localhost:3000/api/v1/planner/batch \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "task": 1, "description": "SupplyCell wrapper" },
      { "task": 2, "description": "Graph Ingestion Listener" },
      { "task": 3, "description": "Scheduled Refresh" },
      { "task": 4, "description": "Embeddings Service" },
      { "task": 5, "description": "Neural Network Index" },
      { "task": 6, "description": "Wire Research Agent" }
    ],
    "task": "Execute neural network buildout task"
  }'
```

---

## Estimated Cost

| Task | Tokens | Cost (DeepSeek) |
|------|--------|-----------------|
| Task 1 | ~1,500 | $0.002 |
| Task 2 | ~2,500 | $0.003 |
| Task 3 | ~2,000 | $0.003 |
| Task 4 | ~1,500 | $0.002 |
| Task 5 | ~500 | $0.001 |
| Task 6 | ~1,000 | $0.001 |
| **Total** | **~9,000** | **~$0.012** |

vs Claude Sonnet: ~$0.15 (12x more expensive)
