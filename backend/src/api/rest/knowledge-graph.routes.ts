/**
 * Knowledge Graph API Routes
 * 
 * Exposes the neural network's knowledge graph for:
 * - Impact analysis (blast radius)
 * - Hybrid search (text + semantic)
 * - Graph traversal
 * - Community detection
 * - Staleness monitoring
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { getKnowledgeGraphService, NodeType, EdgeType } from '../../services/neural-network';

export function createKnowledgeGraphRoutes(pool: Pool): Router {
  const router = Router();
  const graphService = getKnowledgeGraphService(pool);

  // ============================================================================
  // NODE OPERATIONS
  // ============================================================================

  /**
   * GET /api/v1/knowledge-graph/nodes/:id
   * Get a node by ID with staleness info
   */
  router.get('/nodes/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const node = await graphService.getNode(id);
      
      if (!node) {
        return res.status(404).json({ success: false, error: 'Node not found' });
      }
      
      res.json({ success: true, node });
    } catch (error) {
      console.error('[KnowledgeGraph] Error getting node:', error);
      res.status(500).json({ success: false, error: 'Failed to get node' });
    }
  });

  /**
   * GET /api/v1/knowledge-graph/nodes
   * List nodes by type
   */
  router.get('/nodes', async (req: Request, res: Response) => {
    try {
      const { type, limit = '100' } = req.query;
      
      if (!type) {
        return res.status(400).json({ success: false, error: 'type query param required' });
      }
      
      const nodes = await graphService.getNodesByType(
        type as NodeType,
        parseInt(limit as string)
      );
      
      res.json({ 
        success: true, 
        count: nodes.length,
        nodes 
      });
    } catch (error) {
      console.error('[KnowledgeGraph] Error listing nodes:', error);
      res.status(500).json({ success: false, error: 'Failed to list nodes' });
    }
  });

  /**
   * POST /api/v1/knowledge-graph/nodes
   * Create or update a node
   */
  router.post('/nodes', async (req: Request, res: Response) => {
    try {
      const { id, type, name, properties, embedding } = req.body;
      
      if (!id || !type || !name) {
        return res.status(400).json({ 
          success: false, 
          error: 'id, type, and name are required' 
        });
      }
      
      const node = await graphService.upsertNode({
        id,
        type,
        name,
        properties: properties || {},
        embedding
      });
      
      res.json({ success: true, node });
    } catch (error) {
      console.error('[KnowledgeGraph] Error creating node:', error);
      res.status(500).json({ success: false, error: 'Failed to create node' });
    }
  });

  // ============================================================================
  // EDGE OPERATIONS
  // ============================================================================

  /**
   * GET /api/v1/knowledge-graph/nodes/:id/edges
   * Get edges for a node
   */
  router.get('/nodes/:id/edges', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { direction = 'both', types } = req.query;
      
      const edgeTypes = types ? (types as string).split(',') as EdgeType[] : undefined;
      
      const edges = await graphService.getEdges(
        id,
        direction as 'outgoing' | 'incoming' | 'both',
        edgeTypes
      );
      
      res.json({ 
        success: true, 
        count: edges.length,
        edges 
      });
    } catch (error) {
      console.error('[KnowledgeGraph] Error getting edges:', error);
      res.status(500).json({ success: false, error: 'Failed to get edges' });
    }
  });

  /**
   * POST /api/v1/knowledge-graph/edges
   * Create an edge between nodes
   */
  router.post('/edges', async (req: Request, res: Response) => {
    try {
      const { 
        type, 
        sourceId, 
        sourceType, 
        targetId, 
        targetType, 
        weight = 0.5, 
        confidence = 0.5,
        properties,
        reason 
      } = req.body;
      
      if (!type || !sourceId || !sourceType || !targetId || !targetType) {
        return res.status(400).json({ 
          success: false, 
          error: 'type, sourceId, sourceType, targetId, targetType are required' 
        });
      }
      
      const edge = await graphService.createEdge({
        type,
        sourceId,
        sourceType,
        targetId,
        targetType,
        weight,
        confidence,
        properties: properties || {},
        reason: reason || ''
      });
      
      res.json({ success: true, edge });
    } catch (error) {
      console.error('[KnowledgeGraph] Error creating edge:', error);
      res.status(500).json({ success: false, error: 'Failed to create edge' });
    }
  });

  // ============================================================================
  // IMPACT ANALYSIS (BLAST RADIUS)
  // ============================================================================

  /**
   * GET /api/v1/knowledge-graph/impact/:nodeId
   * Analyze what would be affected by changes to this node
   */
  router.get('/impact/:nodeId', async (req: Request, res: Response) => {
    try {
      const { nodeId } = req.params;
      const { maxDepth = '3' } = req.query;
      
      const impact = await graphService.analyzeImpact(
        nodeId,
        parseInt(maxDepth as string)
      );
      
      res.json({ 
        success: true, 
        impact: {
          sourceNode: impact.sourceNode,
          affectedCount: impact.affectedNodes.length,
          riskSummary: impact.riskSummary,
          affectedNodes: impact.affectedNodes.slice(0, 50) // Limit response size
        }
      });
    } catch (error) {
      console.error('[KnowledgeGraph] Error analyzing impact:', error);
      res.status(500).json({ success: false, error: 'Failed to analyze impact' });
    }
  });

  // ============================================================================
  // HYBRID SEARCH
  // ============================================================================

  /**
   * POST /api/v1/knowledge-graph/search
   * Hybrid search combining text and semantic similarity
   */
  router.post('/search', async (req: Request, res: Response) => {
    try {
      const { query, embedding, nodeTypes, limit = 20 } = req.body;
      
      if (!query && !embedding) {
        return res.status(400).json({ 
          success: false, 
          error: 'query or embedding required' 
        });
      }
      
      const results = await graphService.hybridSearch(
        query || '',
        embedding,
        nodeTypes,
        limit
      );
      
      res.json({ 
        success: true, 
        count: results.length,
        results 
      });
    } catch (error) {
      console.error('[KnowledgeGraph] Error searching:', error);
      res.status(500).json({ success: false, error: 'Failed to search' });
    }
  });

  // ============================================================================
  // GRAPH TRAVERSAL
  // ============================================================================

  /**
   * POST /api/v1/knowledge-graph/traverse
   * Walk the graph from a starting node
   */
  router.post('/traverse', async (req: Request, res: Response) => {
    try {
      const {
        startNodeId,
        startNodeType,
        edgeTypes,
        maxDepth = 3,
        direction = 'both',
        nodeTypes,
        minWeight,
        minConfidence,
        limit = 100
      } = req.body;
      
      if (!startNodeId) {
        return res.status(400).json({ 
          success: false, 
          error: 'startNodeId required' 
        });
      }
      
      const result = await graphService.traverse({
        startNodeId,
        startNodeType,
        edgeTypes,
        maxDepth,
        direction,
        nodeTypes,
        minWeight,
        minConfidence,
        limit
      });
      
      res.json({ 
        success: true, 
        nodeCount: result.nodes.length,
        edgeCount: result.edges.length,
        pathCount: result.paths.length,
        ...result
      });
    } catch (error) {
      console.error('[KnowledgeGraph] Error traversing:', error);
      res.status(500).json({ success: false, error: 'Failed to traverse graph' });
    }
  });

  // ============================================================================
  // COMMUNITY DETECTION
  // ============================================================================

  /**
   * GET /api/v1/knowledge-graph/communities
   * Detect property clusters
   */
  router.get('/communities', async (req: Request, res: Response) => {
    try {
      const { nodeType = 'Property' } = req.query;
      
      const communities = await graphService.detectCommunities(nodeType as NodeType);
      
      res.json({ 
        success: true, 
        count: communities.length,
        communities 
      });
    } catch (error) {
      console.error('[KnowledgeGraph] Error detecting communities:', error);
      res.status(500).json({ success: false, error: 'Failed to detect communities' });
    }
  });

  // ============================================================================
  // STALENESS MONITORING
  // ============================================================================

  /**
   * GET /api/v1/knowledge-graph/staleness
   * Get staleness statistics
   */
  router.get('/staleness', async (req: Request, res: Response) => {
    try {
      const stats = await graphService.getStalenessStats();
      
      res.json({ 
        success: true, 
        ...stats
      });
    } catch (error) {
      console.error('[KnowledgeGraph] Error getting staleness:', error);
      res.status(500).json({ success: false, error: 'Failed to get staleness stats' });
    }
  });

  /**
   * GET /api/v1/knowledge-graph/stale-nodes
   * Get nodes that need refreshing
   */
  router.get('/stale-nodes', async (req: Request, res: Response) => {
    try {
      const { type, limit = '100' } = req.query;
      
      const nodes = await graphService.getStaleNodes(
        type as NodeType | undefined,
        parseInt(limit as string)
      );
      
      res.json({ 
        success: true, 
        count: nodes.length,
        nodes 
      });
    } catch (error) {
      console.error('[KnowledgeGraph] Error getting stale nodes:', error);
      res.status(500).json({ success: false, error: 'Failed to get stale nodes' });
    }
  });

  // ============================================================================
  // INGEST HELPERS
  // ============================================================================

  /**
   * POST /api/v1/knowledge-graph/ingest/property
   * Ingest a property into the graph
   */
  router.post('/ingest/property', async (req: Request, res: Response) => {
    try {
      const property = req.body;
      
      if (!property.id || !property.address || !property.city || !property.state) {
        return res.status(400).json({ 
          success: false, 
          error: 'id, address, city, state required' 
        });
      }
      
      const node = await graphService.ingestProperty(property);
      
      res.json({ success: true, node });
    } catch (error) {
      console.error('[KnowledgeGraph] Error ingesting property:', error);
      res.status(500).json({ success: false, error: 'Failed to ingest property' });
    }
  });

  /**
   * POST /api/v1/knowledge-graph/ingest/event
   * Ingest a market event into the graph
   */
  router.post('/ingest/event', async (req: Request, res: Response) => {
    try {
      const event = req.body;
      
      if (!event.id || !event.type || !event.title) {
        return res.status(400).json({ 
          success: false, 
          error: 'id, type, title required' 
        });
      }
      
      const node = await graphService.ingestEvent(event);
      
      res.json({ success: true, node });
    } catch (error) {
      console.error('[KnowledgeGraph] Error ingesting event:', error);
      res.status(500).json({ success: false, error: 'Failed to ingest event' });
    }
  });

  return router;
}

export default createKnowledgeGraphRoutes;
