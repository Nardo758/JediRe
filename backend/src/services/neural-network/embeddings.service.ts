/**
 * Embeddings Service
 * 
 * Generates and caches vector embeddings for knowledge graph nodes.
 * Enables semantic search across the graph.
 * 
 * Models supported:
 * - OpenAI text-embedding-ada-002 (1536 dimensions)
 * - OpenAI text-embedding-3-small (1536 dimensions)
 * - Future: Local models via Ollama
 */

import { Pool } from 'pg';

export interface EmbeddingResult {
  nodeId: string;
  embedding: number[];
  model: string;
  dimensions: number;
}

export interface SimilarityResult {
  nodeId: string;
  nodeType: string;
  name: string;
  externalId: string;
  similarity: number;
}

export class EmbeddingsService {
  private pool: Pool;
  private model = 'text-embedding-ada-002';
  private dimensions = 1536;
  private openaiKey: string | undefined;

  constructor(pool: Pool) {
    this.pool = pool;
    this.openaiKey = process.env.OPENAI_API_KEY;
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openaiKey) {
      console.warn('[Embeddings] No OPENAI_API_KEY, returning zero vector');
      return new Array(this.dimensions).fill(0);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: text.substring(0, 8000), // Limit to 8k chars
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[Embeddings] OpenAI API error:', error);
        return new Array(this.dimensions).fill(0);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('[Embeddings] Failed to generate embedding:', error);
      return new Array(this.dimensions).fill(0);
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async batchGenerate(texts: string[]): Promise<number[][]> {
    if (!this.openaiKey) {
      console.warn('[Embeddings] No OPENAI_API_KEY, returning zero vectors');
      return texts.map(() => new Array(this.dimensions).fill(0));
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: texts.map(t => t.substring(0, 8000)),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[Embeddings] OpenAI batch API error:', error);
        return texts.map(() => new Array(this.dimensions).fill(0));
      }

      const data = await response.json();
      return data.data.map((d: any) => d.embedding);
    } catch (error) {
      console.error('[Embeddings] Failed to batch generate:', error);
      return texts.map(() => new Array(this.dimensions).fill(0));
    }
  }

  /**
   * Cache embedding for a node
   */
  async cacheEmbedding(nodeId: string, embedding: number[]): Promise<void> {
    // First check if table exists
    const tableCheck = await this.pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'kg_embeddings_cache'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      // Create table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS kg_embeddings_cache (
          node_id UUID PRIMARY KEY REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
          embedding JSONB NOT NULL,
          model VARCHAR(100) NOT NULL,
          dimensions INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    }

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

  /**
   * Get cached embedding for a node
   */
  async getEmbedding(nodeId: string): Promise<number[] | null> {
    try {
      const query = `
        SELECT embedding FROM kg_embeddings_cache WHERE node_id = $1
      `;

      const result = await this.pool.query(query, [nodeId]);
      if (result.rows.length === 0) return null;

      return JSON.parse(result.rows[0].embedding);
    } catch (e) {
      return null;
    }
  }

  /**
   * Embed a node (generate + cache)
   */
  async embedNode(nodeId: string): Promise<EmbeddingResult | null> {
    // Get node details
    const nodeQuery = `
      SELECT id, node_type, name, properties
      FROM knowledge_graph_nodes
      WHERE id = $1
    `;
    const nodeResult = await this.pool.query(nodeQuery, [nodeId]);
    if (nodeResult.rows.length === 0) return null;

    const node = nodeResult.rows[0];

    // Create text representation
    const text = this.nodeToText(node);

    // Generate embedding
    const embedding = await this.generateEmbedding(text);

    // Cache it
    await this.cacheEmbedding(nodeId, embedding);

    return {
      nodeId,
      embedding,
      model: this.model,
      dimensions: this.dimensions,
    };
  }

  /**
   * Convert node to searchable text
   */
  private nodeToText(node: any): string {
    const parts = [
      `Type: ${node.node_type}`,
      `Name: ${node.name}`,
    ];

    // Add relevant properties
    const props = node.properties || {};
    if (props.address) parts.push(`Address: ${props.address}`);
    if (props.city) parts.push(`City: ${props.city}`);
    if (props.state) parts.push(`State: ${props.state}`);
    if (props.propertyType) parts.push(`Property Type: ${props.propertyType}`);
    if (props.units) parts.push(`Units: ${props.units}`);
    if (props.description) parts.push(`Description: ${props.description}`);
    if (props.developer) parts.push(`Developer: ${props.developer}`);
    if (props.eventType) parts.push(`Event: ${props.eventType}`);

    return parts.join('. ');
  }

  /**
   * Similarity search using cosine distance
   * Note: For production, use pgvector extension
   */
  async similaritySearch(
    queryText: string,
    limit = 10,
    nodeTypes?: string[]
  ): Promise<SimilarityResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(queryText);

    // For now, do simple comparison in JS
    // In production, use pgvector: embedding <=> $1
    const typeFilter = nodeTypes?.length 
      ? `AND n.node_type = ANY($1::text[])` 
      : '';

    const query = `
      SELECT 
        n.id as node_id,
        n.node_type,
        n.name,
        n.external_id,
        c.embedding
      FROM knowledge_graph_nodes n
      JOIN kg_embeddings_cache c ON c.node_id = n.id
      ${typeFilter ? 'WHERE 1=1 ' + typeFilter : ''}
      LIMIT 1000
    `;

    try {
      const params = nodeTypes?.length ? [nodeTypes] : [];
      const result = await this.pool.query(query, params);

      // Calculate cosine similarity
      const scored = result.rows.map(row => {
        const embedding = JSON.parse(row.embedding);
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        return {
          nodeId: row.node_id,
          nodeType: row.node_type,
          name: row.name,
          externalId: row.external_id,
          similarity,
        };
      });

      // Sort by similarity descending
      scored.sort((a, b) => b.similarity - a.similarity);

      return scored.slice(0, limit);
    } catch (e) {
      console.error('[Embeddings] Similarity search failed:', e);
      return [];
    }
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Embed all nodes that don't have embeddings
   */
  async embedAllMissing(batchSize = 50): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    // Get nodes without embeddings
    const query = `
      SELECT n.id, n.node_type, n.name, n.properties
      FROM knowledge_graph_nodes n
      LEFT JOIN kg_embeddings_cache c ON c.node_id = n.id
      WHERE c.node_id IS NULL
      LIMIT $1
    `;

    const result = await this.pool.query(query, [batchSize]);

    for (const node of result.rows) {
      try {
        const text = this.nodeToText(node);
        const embedding = await this.generateEmbedding(text);
        await this.cacheEmbedding(node.id, embedding);
        processed++;
      } catch (e) {
        errors++;
      }
    }

    return { processed, errors };
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
