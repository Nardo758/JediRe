/**
 * Embeddings Service
 *
 * Generates and stores vector embeddings for knowledge graph nodes,
 * enabling semantic search across the graph.
 *
 * Schema contract (see backend/src/database/migrations/20260425_knowledge_graph.sql):
 *   - knowledge_graph_nodes.embedding   vector(384)
 *   - HNSW cosine index on that column
 *   - kg_semantic_search(p_embedding, p_node_types, p_limit) SQL function
 *
 * The OpenAI model `text-embedding-3-small` is requested with the
 * `dimensions=384` parameter so the output vector matches the column type
 * and existing index without any schema migration.
 *
 * Re-embedding is skipped when the source content hash hasn't changed
 * (mirrored into knowledge_graph_embedding_cache).
 */

import { Pool } from 'pg';
import { createHash } from 'crypto';

const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings';
const MODEL = 'text-embedding-3-small';
const DIMENSIONS = 384; // must match knowledge_graph_nodes.embedding column type
const MAX_INPUT_CHARS = 8000;
const BATCH_SIZE_API = 96; // OpenAI accepts up to 2048; keep payload small

export interface EmbeddingResult {
  nodeId: string;
  dimensions: number;
  model: string;
  cached: boolean;
}

export interface SimilarityResult {
  id: string;
  type: string;
  name: string;
  properties: Record<string, any>;
  similarity: number;
}

export interface BackfillStats {
  scanned: number;
  embedded: number;
  cached: number;
  errors: number;
  hasKey: boolean;
}

interface NodeRow {
  id: string;
  type: string;
  name: string;
  properties: any;
}

export class EmbeddingsService {
  private pool: Pool;
  private openaiKey: string | undefined;

  constructor(pool: Pool) {
    this.pool = pool;
    this.openaiKey = process.env.OPENAI_API_KEY;
  }

  hasKey(): boolean {
    return Boolean(this.openaiKey);
  }

  modelInfo() {
    return { model: MODEL, dimensions: DIMENSIONS };
  }

  /**
   * Generate a single embedding. Returns null when no key is configured.
   * Never returns a zero-vector — those would corrupt similarity rankings.
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.openaiKey) return null;

    const response = await fetch(OPENAI_EMBED_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        dimensions: DIMENSIONS,
        input: text.slice(0, MAX_INPUT_CHARS),
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`[Embeddings] OpenAI API ${response.status}: ${errBody.slice(0, 300)}`);
    }

    const data = await response.json();
    const vec = data?.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length !== DIMENSIONS) {
      throw new Error(`[Embeddings] OpenAI returned unexpected vector (len=${vec?.length})`);
    }
    return vec;
  }

  /**
   * Batch generate embeddings. Returns null entries for items that fail.
   */
  async batchGenerate(texts: string[]): Promise<(number[] | null)[]> {
    if (!this.openaiKey) return texts.map(() => null);
    if (texts.length === 0) return [];

    const out: (number[] | null)[] = new Array(texts.length).fill(null);

    for (let start = 0; start < texts.length; start += BATCH_SIZE_API) {
      const chunk = texts.slice(start, start + BATCH_SIZE_API);
      try {
        const response = await fetch(OPENAI_EMBED_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: MODEL,
            dimensions: DIMENSIONS,
            input: chunk.map(t => t.slice(0, MAX_INPUT_CHARS)),
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          console.error(`[Embeddings] Batch API ${response.status}: ${errBody.slice(0, 300)}`);
          continue;
        }

        const data = await response.json();
        const items = (data?.data || []) as Array<{ index: number; embedding: number[] }>;
        for (const item of items) {
          const absoluteIdx = start + item.index;
          if (Array.isArray(item.embedding) && item.embedding.length === DIMENSIONS) {
            out[absoluteIdx] = item.embedding;
          }
        }
      } catch (err) {
        console.error('[Embeddings] Batch generate failed:', err);
      }
    }

    return out;
  }

  /**
   * Convert a node row to the searchable text used for embedding.
   * Stable formatting → stable content hash → cache hits on re-embed.
   */
  private nodeToText(node: NodeRow): string {
    const parts: string[] = [
      `Type: ${node.type}`,
      `Name: ${node.name}`,
    ];

    const props = node.properties || {};
    const fields = [
      'address', 'city', 'state', 'msa', 'market', 'submarket',
      'propertyType', 'units', 'yearBuilt', 'classRating',
      'description', 'developer', 'owner', 'broker',
      'eventType', 'date',
    ] as const;

    for (const f of fields) {
      const v = props[f];
      if (v !== undefined && v !== null && v !== '') {
        parts.push(`${f}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
      }
    }

    return parts.join('. ');
  }

  private contentHash(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  /**
   * Format a JS number array into the pgvector text format `[a,b,c]`.
   */
  private toVectorLiteral(embedding: number[]): string {
    return '[' + embedding.join(',') + ']';
  }

  /**
   * Embed a single node by id. Skips work when the content hash hasn't
   * changed (cache hit). Writes the vector to both the nodes table and
   * the embedding cache.
   */
  async embedNode(nodeId: string): Promise<EmbeddingResult | null> {
    const nodeRes = await this.pool.query<NodeRow>(
      `SELECT id, type, name, properties FROM knowledge_graph_nodes WHERE id = $1`,
      [nodeId]
    );
    if (nodeRes.rows.length === 0) return null;
    const node = nodeRes.rows[0];

    const text = this.nodeToText(node);
    const hash = this.contentHash(text);

    const cacheRes = await this.pool.query<{ embedding: string }>(
      `SELECT embedding::text AS embedding
         FROM knowledge_graph_embedding_cache
        WHERE node_id = $1 AND content_hash = $2`,
      [nodeId, hash]
    );

    if (cacheRes.rows.length > 0) {
      // Cache hit — make sure the nodes table also has it
      await this.pool.query(
        `UPDATE knowledge_graph_nodes
            SET embedding = $2::vector,
                updated_at = updated_at
          WHERE id = $1
            AND (embedding IS NULL OR embedding::text <> $2::text)`,
        [nodeId, cacheRes.rows[0].embedding]
      );
      return { nodeId, dimensions: DIMENSIONS, model: MODEL, cached: true };
    }

    if (!this.openaiKey) return null;

    const embedding = await this.generateEmbedding(text);
    if (!embedding) return null;
    const literal = this.toVectorLiteral(embedding);

    await this.pool.query(
      `UPDATE knowledge_graph_nodes
          SET embedding = $2::vector,
              updated_at = updated_at
        WHERE id = $1`,
      [nodeId, literal]
    );

    await this.pool.query(
      `INSERT INTO knowledge_graph_embedding_cache (node_id, content_hash, embedding, model_id, computed_at)
       VALUES ($1, $2, $3::vector, $4, NOW())
       ON CONFLICT (node_id) DO UPDATE SET
         content_hash = EXCLUDED.content_hash,
         embedding    = EXCLUDED.embedding,
         model_id     = EXCLUDED.model_id,
         computed_at  = NOW()`,
      [nodeId, hash, literal, MODEL]
    );

    return { nodeId, dimensions: DIMENSIONS, model: MODEL, cached: false };
  }

  /**
   * Fire-and-forget hook for callers that should never block on embedding.
   */
  embedNodeInBackground(nodeId: string): void {
    if (!this.openaiKey) return;
    this.embedNode(nodeId).catch(err => {
      console.warn(`[Embeddings] background embed failed for ${nodeId}:`, err?.message || err);
    });
  }

  /**
   * Backfill any node missing an embedding (or stale relative to content hash).
   * Uses the batch OpenAI endpoint to keep cost and round-trips low.
   */
  async embedAllMissing(opts: { batchSize?: number; max?: number } = {}): Promise<BackfillStats> {
    const stats: BackfillStats = {
      scanned: 0,
      embedded: 0,
      cached: 0,
      errors: 0,
      hasKey: this.hasKey(),
    };

    const batchSize = Math.min(Math.max(opts.batchSize ?? BATCH_SIZE_API, 1), BATCH_SIZE_API);
    const max = opts.max ?? 1000;

    let processed = 0;
    while (processed < max) {
      const remaining = max - processed;
      const fetchLimit = Math.min(batchSize, remaining);

      const rowsRes = await this.pool.query<NodeRow>(
        `SELECT id, type, name, properties
           FROM knowledge_graph_nodes
          WHERE embedding IS NULL
          ORDER BY updated_at DESC
          LIMIT $1`,
        [fetchLimit]
      );
      if (rowsRes.rows.length === 0) break;

      stats.scanned += rowsRes.rows.length;

      // Try cache first per-row (cheap), fall back to batch generation for misses
      const toGenerate: { row: NodeRow; text: string; hash: string }[] = [];
      for (const row of rowsRes.rows) {
        const text = this.nodeToText(row);
        const hash = this.contentHash(text);
        const cacheRes = await this.pool.query<{ embedding: string }>(
          `SELECT embedding::text AS embedding
             FROM knowledge_graph_embedding_cache
            WHERE node_id = $1 AND content_hash = $2`,
          [row.id, hash]
        );
        if (cacheRes.rows.length > 0) {
          await this.pool.query(
            `UPDATE knowledge_graph_nodes SET embedding = $2::vector WHERE id = $1`,
            [row.id, cacheRes.rows[0].embedding]
          );
          stats.cached += 1;
        } else {
          toGenerate.push({ row, text, hash });
        }
      }

      if (toGenerate.length > 0) {
        if (!this.openaiKey) {
          stats.errors += toGenerate.length;
          break;
        }

        const vectors = await this.batchGenerate(toGenerate.map(x => x.text));
        for (let i = 0; i < toGenerate.length; i++) {
          const v = vectors[i];
          const { row, hash } = toGenerate[i];
          if (!v) {
            stats.errors += 1;
            continue;
          }
          const literal = this.toVectorLiteral(v);
          try {
            await this.pool.query(
              `UPDATE knowledge_graph_nodes SET embedding = $2::vector WHERE id = $1`,
              [row.id, literal]
            );
            await this.pool.query(
              `INSERT INTO knowledge_graph_embedding_cache (node_id, content_hash, embedding, model_id, computed_at)
               VALUES ($1, $2, $3::vector, $4, NOW())
               ON CONFLICT (node_id) DO UPDATE SET
                 content_hash = EXCLUDED.content_hash,
                 embedding    = EXCLUDED.embedding,
                 model_id     = EXCLUDED.model_id,
                 computed_at  = NOW()`,
              [row.id, hash, literal, MODEL]
            );
            stats.embedded += 1;
          } catch (err) {
            console.error(`[Embeddings] write failed for ${row.id}:`, err);
            stats.errors += 1;
          }
        }
      }

      processed += rowsRes.rows.length;
      // Loop: if a partial batch was returned, no more rows remain.
      if (rowsRes.rows.length < fetchLimit) break;
    }

    return stats;
  }

  /**
   * Semantic similarity search using the existing `kg_semantic_search`
   * Postgres function (which uses the HNSW cosine index).
   */
  async similaritySearch(
    queryText: string,
    limit = 10,
    nodeTypes?: string[]
  ): Promise<SimilarityResult[]> {
    const queryEmbedding = await this.generateEmbedding(queryText);
    if (!queryEmbedding) return [];

    const literal = this.toVectorLiteral(queryEmbedding);
    const types = nodeTypes && nodeTypes.length > 0 ? nodeTypes : null;

    const res = await this.pool.query<{
      id: string; type: string; name: string; properties: any; similarity: string;
    }>(
      `SELECT id, type, name, properties, similarity
         FROM kg_semantic_search($1::vector, $2::varchar[], $3::int)`,
      [literal, types, limit]
    );

    return res.rows.map(r => ({
      id: r.id,
      type: r.type,
      name: r.name,
      properties: r.properties || {},
      similarity: parseFloat(r.similarity),
    }));
  }

  /**
   * Count of populated embeddings — for health logging.
   */
  async countEmbedded(): Promise<{ total: number; embedded: number }> {
    const res = await this.pool.query<{ total: string; embedded: string }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(embedding)::text AS embedded
       FROM knowledge_graph_nodes`
    );
    return {
      total: parseInt(res.rows[0]?.total || '0', 10),
      embedded: parseInt(res.rows[0]?.embedded || '0', 10),
    };
  }

  /**
   * Lightweight startup check. Logs status; safe to call from boot.
   */
  async healthCheck(): Promise<void> {
    const has = this.hasKey();
    const counts = await this.countEmbedded().catch(() => ({ total: -1, embedded: -1 }));
    console.log(
      `[Embeddings] OPENAI_API_KEY=${has ? 'set' : 'MISSING'} model=${MODEL} dims=${DIMENSIONS} ` +
      `nodes=${counts.total} embedded=${counts.embedded}`
    );
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
