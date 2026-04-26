/**
 * JediRe Knowledge Graph Service
 * 
 * Inspired by GitNexus architecture, adapted for real estate intelligence.
 * 
 * NODES: Property, Deal, Market, Submarket, Owner, Event, Metric, Document, Agent
 * EDGES: COMP_OF, NEAR, AFFECTS, OWNS, IN_MARKET, CORRELATES_WITH, EXTRACTED_FROM, ANALYZED_BY
 * 
 * KEY FEATURES:
 * 1. Graph-based relationship tracking
 * 2. Impact analysis (blast radius) - "What affects this deal?"
 * 3. Hybrid search (BM25 + vector embeddings)
 * 4. Community detection (property clusters)
 * 5. Staleness detection (data freshness)
 * 
 * FLOW:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                         DATA SOURCES                                    │
 * │  Properties | Sales | Events | Documents | Markets | Agents            │
 * └────────────────────────────────┬────────────────────────────────────────┘
 *                                  │ ingest
 *                                  ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                      KNOWLEDGE GRAPH                                    │
 * │                                                                         │
 * │  ┌──────────┐    COMP_OF     ┌──────────┐    IN_MARKET   ┌──────────┐ │
 * │  │ Property │ ◄────────────► │   Deal   │ ─────────────► │  Market  │ │
 * │  └──────────┘                └──────────┘                └──────────┘ │
 * │       │                           │                           │        │
 * │       │ NEAR                      │ AFFECTS                   │        │
 * │       ▼                           ▼                           ▼        │
 * │  ┌──────────┐               ┌──────────┐               ┌──────────┐   │
 * │  │   POI    │               │  Event   │               │Submarket │   │
 * │  └──────────┘               └──────────┘               └──────────┘   │
 * └────────────────────────────────┬────────────────────────────────────────┘
 *                                  │ query
 *                                  ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                            AGENTS                                       │
 * │  "What affects rent growth?" → Graph walk → Ranked results             │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { Pool } from 'pg';

// ============================================================================
// NODE TYPES
// ============================================================================

export type NodeType = 
  | 'Property'
  | 'Deal'
  | 'Market'
  | 'Submarket'
  | 'Owner'
  | 'Event'
  | 'Metric'
  | 'Document'
  | 'Agent'
  | 'POI'
  | 'Route'  // Transit route
  | 'Employer'
  | 'Permit'
  | 'Sale'
  // OM-derived intelligence — fanned out by GraphIngestionListener.ingestOM
  | 'BrokerNarrative'
  | 'RentComp'
  | 'SaleComp'
  | 'ExpenseBenchmark';

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  properties: Record<string, any>;
  embedding?: number[]; // 384D vector for semantic search
  createdAt: Date;
  updatedAt: Date;
  staleness?: 'fresh' | 'stale' | 'expired';
}

// ============================================================================
// EDGE TYPES
// ============================================================================

export type EdgeType = 
  | 'COMP_OF'           // Property is comp of Deal
  | 'NEAR'              // Property near POI/Transit
  | 'AFFECTS'           // Event affects Property/Market
  | 'OWNS'              // Owner owns Property
  | 'IN_MARKET'         // Property/Deal in Market
  | 'IN_SUBMARKET'      // Property in Submarket
  | 'CORRELATES_WITH'   // Metric correlates with Metric
  | 'EXTRACTED_FROM'    // Data extracted from Document
  | 'ANALYZED_BY'       // Deal analyzed by Agent
  | 'EMPLOYS_IN'        // Employer in Market
  | 'PERMITTED_FOR'     // Permit for Property
  | 'SOLD_AS'           // Property sold as Sale
  | 'STEP_IN_PROCESS'   // Part of deal lifecycle
  | 'SIMILAR_TO';       // Embedding similarity

export interface GraphEdge {
  id: string;
  type: EdgeType;
  sourceId: string;
  sourceType: NodeType;
  targetId: string;
  targetType: NodeType;
  weight: number;       // 0-1 strength
  confidence: number;   // 0-1 confidence
  properties: Record<string, any>;
  reason: string;       // Why this edge exists
  createdAt: Date;
}

// ============================================================================
// QUERY TYPES
// ============================================================================

export interface GraphQuery {
  // Starting point
  startNodeId?: string;
  startNodeType?: NodeType;
  
  // Traversal
  edgeTypes?: EdgeType[];
  maxDepth?: number;
  direction?: 'outgoing' | 'incoming' | 'both';
  
  // Filtering
  nodeTypes?: NodeType[];
  minWeight?: number;
  minConfidence?: number;
  
  // Search
  searchText?: string;
  searchEmbedding?: number[];
  
  // Pagination
  limit?: number;
  offset?: number;
}

export interface ImpactAnalysis {
  sourceNode: GraphNode;
  affectedNodes: Array<{
    node: GraphNode;
    path: GraphEdge[];
    totalWeight: number;
    impactScore: number;
    reason: string;
  }>;
  riskSummary: {
    highImpact: number;
    mediumImpact: number;
    lowImpact: number;
    totalAffected: number;
  };
}

export interface CommunityCluster {
  id: string;
  name: string;
  nodeCount: number;
  nodes: GraphNode[];
  centroid?: GraphNode;
  cohesion: number;      // How tightly connected
  characteristics: Record<string, any>;
}

// ============================================================================
// SERVICE
// ============================================================================

export class KnowledgeGraphService {
  constructor(private pool: Pool) {}
  
  // ==========================================================================
  // NODE OPERATIONS
  // ==========================================================================
  
  /**
   * Create or update a node in the graph
   */
  async upsertNode(node: Omit<GraphNode, 'createdAt' | 'updatedAt' | 'staleness'> & { externalId?: string }): Promise<string> {
    // Use externalId as the node ID if provided, otherwise use node.id or generate one
    const nodeId = (node as any).externalId || node.id || `${node.type}-${Date.now()}`;
    
    const result = await this.pool.query(`
      INSERT INTO knowledge_graph_nodes (id, type, name, properties, embedding)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        type = EXCLUDED.type,
        name = EXCLUDED.name,
        properties = knowledge_graph_nodes.properties || EXCLUDED.properties,
        embedding = COALESCE(EXCLUDED.embedding, knowledge_graph_nodes.embedding),
        updated_at = NOW()
      RETURNING id
    `, [
      nodeId,
      node.type,
      node.name,
      JSON.stringify(node.properties || {}),
      node.embedding ? JSON.stringify(node.embedding) : null
    ]);
    
    return result.rows[0].id;
  }

  /**
   * Find a node by type and external ID
   */
  async findNodeByExternalId(type: string, externalId: string): Promise<{ id: string; type: string; name: string; properties: any } | null> {
    const result = await this.pool.query(`
      SELECT id, type, name, properties
      FROM knowledge_graph_nodes
      WHERE id = $1 AND type = $2
      LIMIT 1
    `, [externalId, type]);
    
    if (result.rows.length === 0) {
      // Also try without type constraint (ID might be globally unique)
      const fallback = await this.pool.query(`
        SELECT id, type, name, properties
        FROM knowledge_graph_nodes
        WHERE id = $1
        LIMIT 1
      `, [externalId]);
      return fallback.rows[0] || null;
    }
    
    return result.rows[0];
  }

  /**
   * Update properties on an existing node (merge)
   */
  async updateNodeProperties(nodeId: string, properties: Record<string, any>): Promise<void> {
    await this.pool.query(`
      UPDATE knowledge_graph_nodes
      SET properties = properties || $2::jsonb,
          updated_at = NOW()
      WHERE id = $1
    `, [nodeId, JSON.stringify(properties)]);
  }
  
  /**
   * Get a node by ID
   */
  async getNode(nodeId: string): Promise<GraphNode | null> {
    const result = await this.pool.query(`
      SELECT *,
        CASE 
          WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 'fresh'
          WHEN updated_at > NOW() - INTERVAL '7 days' THEN 'stale'
          ELSE 'expired'
        END as staleness
      FROM knowledge_graph_nodes
      WHERE id = $1
    `, [nodeId]);
    
    return result.rows[0] ? this.rowToNode(result.rows[0]) : null;
  }
  
  /**
   * Get multiple nodes by type
   */
  async getNodesByType(type: NodeType, limit = 100): Promise<GraphNode[]> {
    const result = await this.pool.query(`
      SELECT *,
        CASE 
          WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 'fresh'
          WHEN updated_at > NOW() - INTERVAL '7 days' THEN 'stale'
          ELSE 'expired'
        END as staleness
      FROM knowledge_graph_nodes
      WHERE type = $1
      ORDER BY updated_at DESC
      LIMIT $2
    `, [type, limit]);
    
    return result.rows.map(r => this.rowToNode(r));
  }
  
  // ==========================================================================
  // EDGE OPERATIONS
  // ==========================================================================
  
  /**
   * Create an edge between nodes
   */
  async createEdge(edge: any): Promise<any> {
    // Accept both naming conventions:
    // { sourceId, targetId, type } (original)
    // { sourceNodeId, targetNodeId, edgeType } (from wiring code)
    const edgeType = edge.edgeType || edge.type;
    const sourceId = edge.sourceNodeId || edge.sourceId;
    const targetId = edge.targetNodeId || edge.targetId;
    const sourceType = edge.sourceType || '';
    const targetType = edge.targetType || '';
    
    const result = await this.pool.query(`
      INSERT INTO knowledge_graph_edges 
        (type, source_id, source_type, target_id, target_type, weight, confidence, properties, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (source_id, target_id, type) DO UPDATE SET
        weight = EXCLUDED.weight,
        confidence = EXCLUDED.confidence,
        properties = knowledge_graph_edges.properties || EXCLUDED.properties,
        reason = EXCLUDED.reason,
        created_at = NOW()
      RETURNING *
    `, [
      edgeType,
      sourceId,
      sourceType,
      targetId,
      targetType,
      edge.weight || 1.0,
      edge.confidence || 0.8,
      JSON.stringify(edge.properties || {}),
      edge.reason || null
    ]);
    
    return result.rows[0];
  }
  
  /**
   * Get edges for a node
   */
  async getEdges(
    nodeId: string, 
    direction: 'outgoing' | 'incoming' | 'both' = 'both',
    edgeTypes?: EdgeType[]
  ): Promise<GraphEdge[]> {
    let query = `SELECT * FROM knowledge_graph_edges WHERE `;
    const params: any[] = [];
    let paramIdx = 1;
    
    if (direction === 'outgoing') {
      query += `source_id = $${paramIdx++}`;
      params.push(nodeId);
    } else if (direction === 'incoming') {
      query += `target_id = $${paramIdx++}`;
      params.push(nodeId);
    } else {
      query += `(source_id = $${paramIdx++} OR target_id = $${paramIdx++})`;
      params.push(nodeId, nodeId);
    }
    
    if (edgeTypes && edgeTypes.length > 0) {
      query += ` AND type = ANY($${paramIdx++})`;
      params.push(edgeTypes);
    }
    
    query += ` ORDER BY weight DESC`;
    
    const result = await this.pool.query(query, params);
    return result.rows.map(r => this.rowToEdge(r));
  }
  
  // ==========================================================================
  // GRAPH TRAVERSAL
  // ==========================================================================
  
  /**
   * Walk the graph from a starting node
   */
  async traverse(query: GraphQuery): Promise<{
    nodes: GraphNode[];
    edges: GraphEdge[];
    paths: Array<{ nodes: string[]; edges: string[]; totalWeight: number }>;
  }> {
    const maxDepth = query.maxDepth || 3;
    const direction = query.direction || 'both';
    
    // Use recursive CTE for graph traversal
    const result = await this.pool.query(`
      WITH RECURSIVE graph_walk AS (
        -- Base case: starting node
        SELECT 
          n.id as node_id,
          n.type as node_type,
          ARRAY[n.id] as path_nodes,
          ARRAY[]::uuid[] as path_edges,
          0 as depth,
          1.0::numeric as cumulative_weight
        FROM knowledge_graph_nodes n
        WHERE n.id = $1
        
        UNION ALL
        
        -- Recursive case: walk edges
        SELECT 
          CASE 
            WHEN e.source_id = gw.node_id THEN e.target_id
            ELSE e.source_id
          END as node_id,
          CASE 
            WHEN e.source_id = gw.node_id THEN e.target_type
            ELSE e.source_type
          END as node_type,
          gw.path_nodes || CASE 
            WHEN e.source_id = gw.node_id THEN e.target_id
            ELSE e.source_id
          END,
          gw.path_edges || e.id,
          gw.depth + 1,
          gw.cumulative_weight * e.weight
        FROM graph_walk gw
        JOIN knowledge_graph_edges e ON (
          ($2 = 'both' AND (e.source_id = gw.node_id OR e.target_id = gw.node_id))
          OR ($2 = 'outgoing' AND e.source_id = gw.node_id)
          OR ($2 = 'incoming' AND e.target_id = gw.node_id)
        )
        WHERE gw.depth < $3
          AND NOT (
            CASE 
              WHEN e.source_id = gw.node_id THEN e.target_id
              ELSE e.source_id
            END = ANY(gw.path_nodes)
          )
          ${query.edgeTypes ? `AND e.type = ANY($4)` : ''}
          ${query.minWeight ? `AND e.weight >= $5` : ''}
      )
      SELECT DISTINCT ON (node_id)
        gw.*,
        n.name,
        n.properties,
        n.embedding
      FROM graph_walk gw
      JOIN knowledge_graph_nodes n ON n.id = gw.node_id
      ${query.nodeTypes ? `WHERE n.type = ANY($6)` : ''}
      ORDER BY node_id, cumulative_weight DESC
      LIMIT $7
    `, [
      query.startNodeId,
      direction,
      maxDepth,
      query.edgeTypes || null,
      query.minWeight || 0,
      query.nodeTypes || null,
      query.limit || 100
    ].filter(p => p !== null));
    
    // Collect unique nodes and edges
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    const paths: Array<{ nodes: string[]; edges: string[]; totalWeight: number }> = [];
    
    for (const row of result.rows) {
      nodeIds.add(row.node_id);
      row.path_nodes.forEach((n: string) => nodeIds.add(n));
      row.path_edges.forEach((e: string) => edgeIds.add(e));
      
      paths.push({
        nodes: row.path_nodes,
        edges: row.path_edges,
        totalWeight: parseFloat(row.cumulative_weight)
      });
    }
    
    // Fetch full node/edge objects
    const nodes = await this.getNodesByIds([...nodeIds]);
    const edges = await this.getEdgesByIds([...edgeIds]);
    
    return { nodes, edges, paths };
  }
  
  // ==========================================================================
  // IMPACT ANALYSIS (Blast Radius)
  // ==========================================================================
  
  /**
   * Analyze what a change to this node would affect
   * Inspired by GitNexus impact analysis
   */
  async analyzeImpact(nodeId: string, maxDepth = 3): Promise<ImpactAnalysis> {
    const sourceNode = await this.getNode(nodeId);
    if (!sourceNode) {
      throw new Error(`Node ${nodeId} not found`);
    }
    
    // Traverse outgoing to find affected nodes
    const { nodes, edges, paths } = await this.traverse({
      startNodeId: nodeId,
      direction: 'outgoing',
      maxDepth,
      edgeTypes: ['AFFECTS', 'COMP_OF', 'IN_MARKET', 'CORRELATES_WITH'],
      minWeight: 0.3
    });
    
    // Calculate impact scores
    const affectedNodes = nodes
      .filter(n => n.id !== nodeId)
      .map(node => {
        const nodePaths = paths.filter(p => p.nodes.includes(node.id));
        const bestPath = nodePaths.sort((a, b) => b.totalWeight - a.totalWeight)[0];
        const pathEdges = bestPath?.edges 
          ? edges.filter(e => bestPath.edges.includes(e.id))
          : [];
        
        // Impact score based on path weight and node importance
        const pathWeight = bestPath?.totalWeight || 0;
        const nodeImportance = this.calculateNodeImportance(node);
        const impactScore = pathWeight * nodeImportance;
        
        return {
          node,
          path: pathEdges,
          totalWeight: pathWeight,
          impactScore,
          reason: this.generateImpactReason(sourceNode, node, pathEdges)
        };
      })
      .sort((a, b) => b.impactScore - a.impactScore);
    
    // Risk summary
    const highImpact = affectedNodes.filter(n => n.impactScore >= 0.7).length;
    const mediumImpact = affectedNodes.filter(n => n.impactScore >= 0.4 && n.impactScore < 0.7).length;
    const lowImpact = affectedNodes.filter(n => n.impactScore < 0.4).length;
    
    return {
      sourceNode,
      affectedNodes,
      riskSummary: {
        highImpact,
        mediumImpact,
        lowImpact,
        totalAffected: affectedNodes.length
      }
    };
  }
  
  // ==========================================================================
  // HYBRID SEARCH (BM25 + Vector)
  // ==========================================================================
  
  /**
   * Search the graph using text + semantic similarity
   * Inspired by GitNexus hybrid search with Reciprocal Rank Fusion
   */
  async hybridSearch(
    searchText: string,
    embedding?: number[],
    nodeTypes?: NodeType[],
    limit = 20
  ): Promise<Array<{ node: GraphNode; score: number; matchType: 'text' | 'semantic' | 'hybrid' }>> {
    const results: Array<{ node: GraphNode; textScore: number; vectorScore: number }> = [];
    
    // BM25 text search
    const textResults = await this.pool.query(`
      SELECT *,
        ts_rank_cd(
          to_tsvector('english', name || ' ' || COALESCE(properties->>'description', '')),
          plainto_tsquery('english', $1)
        ) as text_score
      FROM knowledge_graph_nodes
      WHERE to_tsvector('english', name || ' ' || COALESCE(properties->>'description', ''))
            @@ plainto_tsquery('english', $1)
        ${nodeTypes ? `AND type = ANY($2)` : ''}
      ORDER BY text_score DESC
      LIMIT $3
    `, nodeTypes ? [searchText, nodeTypes, limit * 2] : [searchText, limit * 2]);
    
    for (const row of textResults.rows) {
      results.push({
        node: this.rowToNode(row),
        textScore: parseFloat(row.text_score) || 0,
        vectorScore: 0
      });
    }
    
    // Vector search if embedding provided
    if (embedding && embedding.length > 0) {
      const vectorResults = await this.pool.query(`
        SELECT *,
          1 - (embedding <=> $1::vector) as vector_score
        FROM knowledge_graph_nodes
        WHERE embedding IS NOT NULL
          ${nodeTypes ? `AND type = ANY($2)` : ''}
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `, nodeTypes ? [JSON.stringify(embedding), nodeTypes, limit * 2] : [JSON.stringify(embedding), limit * 2]);
      
      for (const row of vectorResults.rows) {
        const existing = results.find(r => r.node.id === row.id);
        if (existing) {
          existing.vectorScore = parseFloat(row.vector_score) || 0;
        } else {
          results.push({
            node: this.rowToNode(row),
            textScore: 0,
            vectorScore: parseFloat(row.vector_score) || 0
          });
        }
      }
    }
    
    // Reciprocal Rank Fusion (RRF) with K=60
    const K = 60;
    const scored = results.map(r => {
      const textRank = results.filter(x => x.textScore > r.textScore).length + 1;
      const vectorRank = results.filter(x => x.vectorScore > r.vectorScore).length + 1;
      
      const textRRF = r.textScore > 0 ? 1 / (K + textRank) : 0;
      const vectorRRF = r.vectorScore > 0 ? 1 / (K + vectorRank) : 0;
      const combinedScore = textRRF + vectorRRF;
      
      let matchType: 'text' | 'semantic' | 'hybrid' = 'text';
      if (textRRF > 0 && vectorRRF > 0) matchType = 'hybrid';
      else if (vectorRRF > 0) matchType = 'semantic';
      
      return {
        node: r.node,
        score: combinedScore,
        matchType
      };
    });
    
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  // ==========================================================================
  // COMMUNITY DETECTION
  // ==========================================================================
  
  /**
   * Detect property clusters (communities) in the graph
   * Uses Leiden-like algorithm via SQL
   */
  async detectCommunities(nodeType: NodeType = 'Property'): Promise<CommunityCluster[]> {
    // Simple community detection based on shared edges
    const result = await this.pool.query(`
      WITH node_connections AS (
        SELECT 
          n.id,
          n.name,
          n.properties,
          array_agg(DISTINCT e.target_id) as connections,
          COUNT(DISTINCT e.target_id) as connection_count
        FROM knowledge_graph_nodes n
        LEFT JOIN knowledge_graph_edges e ON e.source_id = n.id
        WHERE n.type = $1
        GROUP BY n.id, n.name, n.properties
      ),
      similarity_pairs AS (
        SELECT 
          a.id as node_a,
          b.id as node_b,
          cardinality(a.connections & b.connections)::float / 
            NULLIF(cardinality(a.connections | b.connections), 0) as jaccard
        FROM node_connections a
        CROSS JOIN node_connections b
        WHERE a.id < b.id
          AND cardinality(a.connections & b.connections) > 0
      ),
      clusters AS (
        SELECT 
          node_a as node_id,
          DENSE_RANK() OVER (ORDER BY array_agg(node_b)) as cluster_id
        FROM similarity_pairs
        WHERE jaccard > 0.3
        GROUP BY node_a
      )
      SELECT 
        c.cluster_id,
        array_agg(n.id) as node_ids,
        array_agg(n.name) as node_names,
        COUNT(*) as node_count
      FROM clusters c
      JOIN knowledge_graph_nodes n ON n.id = c.node_id
      GROUP BY c.cluster_id
      HAVING COUNT(*) >= 3
      ORDER BY node_count DESC
    `, [nodeType]);
    
    return result.rows.map((row, idx) => ({
      id: `cluster-${row.cluster_id}`,
      name: `${nodeType} Cluster ${idx + 1}`,
      nodeCount: parseInt(row.node_count),
      nodes: [], // Would need to fetch full nodes
      cohesion: 0.5, // Would need to calculate
      characteristics: {
        nodeNames: row.node_names.slice(0, 5)
      }
    }));
  }
  
  // ==========================================================================
  // STALENESS DETECTION
  // ==========================================================================
  
  /**
   * Get stale nodes that need refreshing
   */
  async getStaleNodes(type?: NodeType, limit = 100): Promise<GraphNode[]> {
    const result = await this.pool.query(`
      SELECT *,
        CASE 
          WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 'fresh'
          WHEN updated_at > NOW() - INTERVAL '7 days' THEN 'stale'
          ELSE 'expired'
        END as staleness
      FROM knowledge_graph_nodes
      WHERE updated_at < NOW() - INTERVAL '7 days'
        ${type ? `AND type = $1` : ''}
      ORDER BY updated_at ASC
      LIMIT $2
    `, type ? [type, limit] : [limit]);
    
    return result.rows.map(r => this.rowToNode(r));
  }
  
  /**
   * Get staleness stats
   */
  async getStalenessStats(): Promise<{
    byType: Record<NodeType, { fresh: number; stale: number; expired: number }>;
    overall: { fresh: number; stale: number; expired: number };
  }> {
    const result = await this.pool.query(`
      SELECT 
        type,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '24 hours') as fresh,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '7 days' AND updated_at <= NOW() - INTERVAL '24 hours') as stale,
        COUNT(*) FILTER (WHERE updated_at <= NOW() - INTERVAL '7 days') as expired
      FROM knowledge_graph_nodes
      GROUP BY type
    `);
    
    const byType: Record<string, { fresh: number; stale: number; expired: number }> = {};
    let totalFresh = 0, totalStale = 0, totalExpired = 0;
    
    for (const row of result.rows) {
      byType[row.type] = {
        fresh: parseInt(row.fresh),
        stale: parseInt(row.stale),
        expired: parseInt(row.expired)
      };
      totalFresh += parseInt(row.fresh);
      totalStale += parseInt(row.stale);
      totalExpired += parseInt(row.expired);
    }
    
    return {
      byType: byType as Record<NodeType, { fresh: number; stale: number; expired: number }>,
      overall: { fresh: totalFresh, stale: totalStale, expired: totalExpired }
    };
  }
  
  // ==========================================================================
  // INGEST HELPERS
  // ==========================================================================
  
  /**
   * Ingest a property into the graph
   */
  async ingestProperty(property: {
    id: string;
    address: string;
    city: string;
    state: string;
    county?: string;
    units?: number;
    yearBuilt?: number;
    ownerName?: string;
    latitude?: number;
    longitude?: number;
    submarket?: string;
    market?: string;
  }): Promise<GraphNode> {
    // Create property node
    const node = await this.upsertNode({
      id: `property:${property.id}`,
      type: 'Property',
      name: property.address,
      properties: {
        city: property.city,
        state: property.state,
        county: property.county,
        units: property.units,
        yearBuilt: property.yearBuilt,
        ownerName: property.ownerName,
        latitude: property.latitude,
        longitude: property.longitude
      }
    });
    
    // Create market edge if market known
    if (property.market) {
      await this.createEdge({
        type: 'IN_MARKET',
        sourceId: node.id,
        sourceType: 'Property',
        targetId: `market:${property.market.toLowerCase()}`,
        targetType: 'Market',
        weight: 1.0,
        confidence: 1.0,
        properties: {},
        reason: `Property located in ${property.market}`
      });
    }
    
    // Create submarket edge if known
    if (property.submarket) {
      await this.createEdge({
        type: 'IN_SUBMARKET',
        sourceId: node.id,
        sourceType: 'Property',
        targetId: `submarket:${property.submarket.toLowerCase().replace(/\s+/g, '-')}`,
        targetType: 'Submarket',
        weight: 1.0,
        confidence: 1.0,
        properties: {},
        reason: `Property in ${property.submarket} submarket`
      });
    }
    
    return node;
  }
  
  /**
   * Ingest a market event
   */
  async ingestEvent(event: {
    id: string;
    type: string;
    title: string;
    description?: string;
    market?: string;
    submarket?: string;
    impactScore?: number;
    affectedPropertyIds?: string[];
  }): Promise<GraphNode> {
    const node = await this.upsertNode({
      id: `event:${event.id}`,
      type: 'Event',
      name: event.title,
      properties: {
        eventType: event.type,
        description: event.description,
        market: event.market,
        submarket: event.submarket,
        impactScore: event.impactScore
      }
    });
    
    // Create AFFECTS edges to properties
    if (event.affectedPropertyIds) {
      for (const propId of event.affectedPropertyIds) {
        await this.createEdge({
          type: 'AFFECTS',
          sourceId: node.id,
          sourceType: 'Event',
          targetId: `property:${propId}`,
          targetType: 'Property',
          weight: event.impactScore || 0.5,
          confidence: 0.8,
          properties: {},
          reason: `${event.type} event affects property`
        });
      }
    }
    
    return node;
  }
  
  // ==========================================================================
  // HELPERS
  // ==========================================================================
  
  private async getNodesByIds(ids: string[]): Promise<GraphNode[]> {
    if (ids.length === 0) return [];
    
    const result = await this.pool.query(`
      SELECT *,
        CASE 
          WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 'fresh'
          WHEN updated_at > NOW() - INTERVAL '7 days' THEN 'stale'
          ELSE 'expired'
        END as staleness
      FROM knowledge_graph_nodes
      WHERE id = ANY($1)
    `, [ids]);
    
    return result.rows.map(r => this.rowToNode(r));
  }
  
  private async getEdgesByIds(ids: string[]): Promise<GraphEdge[]> {
    if (ids.length === 0) return [];
    
    const result = await this.pool.query(`
      SELECT * FROM knowledge_graph_edges WHERE id = ANY($1)
    `, [ids]);
    
    return result.rows.map(r => this.rowToEdge(r));
  }
  
  private rowToNode(row: any): GraphNode {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties,
      embedding: row.embedding ? (typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      staleness: row.staleness
    };
  }
  
  private rowToEdge(row: any): GraphEdge {
    return {
      id: row.id,
      type: row.type,
      sourceId: row.source_id,
      sourceType: row.source_type,
      targetId: row.target_id,
      targetType: row.target_type,
      weight: parseFloat(row.weight),
      confidence: parseFloat(row.confidence),
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties,
      reason: row.reason,
      createdAt: new Date(row.created_at)
    };
  }
  
  private calculateNodeImportance(node: GraphNode): number {
    // Higher importance for certain node types
    const typeWeights: Record<NodeType, number> = {
      Deal: 1.0,
      Property: 0.9,
      Market: 0.85,
      Submarket: 0.8,
      Event: 0.75,
      Owner: 0.7,
      Employer: 0.7,
      Sale: 0.65,
      SaleComp: 0.6,
      RentComp: 0.55,
      ExpenseBenchmark: 0.5,
      BrokerNarrative: 0.45,
      Permit: 0.6,
      POI: 0.5,
      Route: 0.5,
      Document: 0.4,
      Metric: 0.4,
      Agent: 0.3
    };
    
    return typeWeights[node.type] || 0.5;
  }
  
  private generateImpactReason(source: GraphNode, target: GraphNode, path: GraphEdge[]): string {
    if (path.length === 0) {
      return `Direct impact on ${target.type}`;
    }
    
    const edgeTypes = path.map(e => e.type).join(' → ');
    return `${source.type} ${edgeTypes} ${target.type}: ${target.name}`;
  }
}

// Singleton
let knowledgeGraphInstance: KnowledgeGraphService | null = null;

export function getKnowledgeGraphService(pool: Pool): KnowledgeGraphService {
  if (!knowledgeGraphInstance) {
    knowledgeGraphInstance = new KnowledgeGraphService(pool);
  }
  return knowledgeGraphInstance;
}

// Alias used by graph wiring code
export const getKnowledgeGraph = getKnowledgeGraphService;
