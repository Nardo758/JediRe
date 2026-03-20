/**
 * Intelligence Context Engine Service
 * Provides semantic search, document relationships, and agent learning capabilities
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════

export interface UnifiedDocument {
  id: string;
  sourceSystem: string;
  sourceId: string;
  externalUrl?: string;
  documentType: string;
  title: string;
  contentText?: string;
  contentEmbedding?: number[];
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  propertyType?: string;
  unitCount?: number;
  lotSizeSf?: number;
  yearBuilt?: number;
  dealCapsuleId?: string;
  structuredData: Record<string, any>;
  confidenceScore?: number;
  validationStatus: string;
  validationNotes?: string;
  dataQualityFlags: Array<{ field: string; issue: string; severity: string }>;
  createdByAgent?: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentRelationship {
  id: string;
  parentDocId: string;
  childDocId: string;
  relationshipType: string;
  confidence?: number;
  detectedBy?: string;
  detectedAt: Date;
  metadata: Record<string, any>;
  notes?: string;
}

export interface FieldMapping {
  id: string;
  sourceDocumentType: string;
  sourceFieldName: string;
  sourceFieldAliases: string[];
  canonicalField: string;
  canonicalType: string;
  canonicalUnit?: string;
  transformationRule: Record<string, any>;
  validationRule: Record<string, any>;
  priority: number;
  isActive: boolean;
}

export interface AgentLearning {
  id: string;
  agentType: string;
  taskId?: string;
  dealCapsuleId?: string;
  contextDocuments: string[];
  contextSummary?: string;
  contextEmbedding?: number[];
  inputParams: Record<string, any>;
  outputResult: Record<string, any>;
  outputConfidence?: number;
  executionTimeMs?: number;
  dataSourcesUsed: string[];
  userValidation?: string;
  userCorrections?: Record<string, any>;
  userFeedbackNotes?: string;
  similarTaskIds?: string[];
  similarityScores?: number[];
  outcomeStatus?: string;
  outcomeNotes?: string;
  userId?: string;
  createdAt: Date;
}

export interface SemanticSearchParams {
  query?: string;
  queryEmbedding?: number[];
  filters?: {
    documentType?: string | string[];
    propertyCity?: string;
    propertyState?: string;
    propertyType?: string;
    dealCapsuleId?: string;
    validationStatus?: string | string[];
    minConfidence?: number;
  };
  limit?: number;
  minSimilarity?: number;
}

export interface SemanticSearchResult extends UnifiedDocument {
  similarity: number;
}

export interface AgentContextResult {
  primaryDocuments: SemanticSearchResult[];
  supplementalDocuments: UnifiedDocument[];
  comparableDeals: Array<{
    dealName: string;
    similarity: number;
    outcome: string;
    timelineDays?: number;
  }>;
  historicalLearnings: Array<{
    pattern: string;
    statistics: Record<string, any>;
  }>;
  normalizedFields: Record<string, any>;
  confidenceScore: number;
  dataQualityFlags: Array<{ field: string; issue: string; severity: string }>;
}

// ═══════════════════════════════════════════════════════════════
// Intelligence Context Service
// ═══════════════════════════════════════════════════════════════

export class IntelligenceContextService {
  constructor(private pool: Pool) {}

  /**
   * Index a new document in the unified registry
   */
  async indexDocument(doc: Partial<UnifiedDocument>): Promise<UnifiedDocument> {
    try {
      const result = await this.pool.query(
        `INSERT INTO unified_documents (
          source_system, source_id, external_url, document_type, title,
          content_text, content_embedding, property_address, property_city,
          property_state, property_zip, property_type, unit_count, lot_size_sf,
          year_built, deal_capsule_id, structured_data, confidence_score,
          validation_status, validation_notes, data_quality_flags,
          created_by_agent, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        ON CONFLICT (source_system, source_id) 
        DO UPDATE SET
          title = EXCLUDED.title,
          content_text = EXCLUDED.content_text,
          content_embedding = EXCLUDED.content_embedding,
          structured_data = EXCLUDED.structured_data,
          updated_at = NOW()
        RETURNING *`,
        [
          doc.sourceSystem,
          doc.sourceId,
          doc.externalUrl,
          doc.documentType,
          doc.title,
          doc.contentText,
          doc.contentEmbedding ? `[${doc.contentEmbedding.join(',')}]` : null,
          doc.propertyAddress,
          doc.propertyCity,
          doc.propertyState,
          doc.propertyZip,
          doc.propertyType,
          doc.unitCount,
          doc.lotSizeSf,
          doc.yearBuilt,
          doc.dealCapsuleId,
          JSON.stringify(doc.structuredData || {}),
          doc.confidenceScore,
          doc.validationStatus || 'pending',
          doc.validationNotes,
          JSON.stringify(doc.dataQualityFlags || []),
          doc.createdByAgent,
          doc.userId,
        ]
      );

      logger.info('Document indexed:', {
        docId: result.rows[0].id,
        type: doc.documentType,
        source: doc.sourceSystem,
      });

      return this.mapDocument(result.rows[0]);
    } catch (error) {
      logger.error('Failed to index document:', error);
      throw error;
    }
  }

  /**
   * Semantic search across documents using vector similarity
   */
  async semanticSearch(params: SemanticSearchParams): Promise<SemanticSearchResult[]> {
    try {
      const conditions: string[] = ['1=1'];
      const values: any[] = [];
      let paramIndex = 1;

      // Apply filters
      if (params.filters) {
        const { filters } = params;

        if (filters.documentType) {
          if (Array.isArray(filters.documentType)) {
            conditions.push(`document_type = ANY($${paramIndex})`);
            values.push(filters.documentType);
          } else {
            conditions.push(`document_type = $${paramIndex}`);
            values.push(filters.documentType);
          }
          paramIndex++;
        }

        if (filters.propertyCity) {
          conditions.push(`property_city ILIKE $${paramIndex}`);
          values.push(`%${filters.propertyCity}%`);
          paramIndex++;
        }

        if (filters.propertyState) {
          conditions.push(`property_state = $${paramIndex}`);
          values.push(filters.propertyState);
          paramIndex++;
        }

        if (filters.propertyType) {
          conditions.push(`property_type ILIKE $${paramIndex}`);
          values.push(`%${filters.propertyType}%`);
          paramIndex++;
        }

        if (filters.dealCapsuleId) {
          conditions.push(`deal_capsule_id = $${paramIndex}`);
          values.push(filters.dealCapsuleId);
          paramIndex++;
        }

        if (filters.validationStatus) {
          if (Array.isArray(filters.validationStatus)) {
            conditions.push(`validation_status = ANY($${paramIndex})`);
            values.push(filters.validationStatus);
          } else {
            conditions.push(`validation_status = $${paramIndex}`);
            values.push(filters.validationStatus);
          }
          paramIndex++;
        }

        if (filters.minConfidence !== undefined) {
          conditions.push(`confidence_score >= $${paramIndex}`);
          values.push(filters.minConfidence);
          paramIndex++;
        }
      }

      const whereClause = conditions.join(' AND ');
      const limit = params.limit || 10;
      const minSimilarity = params.minSimilarity || 0.7;

      let query: string;

      if (params.queryEmbedding) {
        // Vector similarity search
        const embeddingParam = paramIndex;
        values.push(`[${params.queryEmbedding.join(',')}]`);
        paramIndex++;

        const minSimilarityParam = paramIndex;
        values.push(minSimilarity);
        paramIndex++;

        const limitParam = paramIndex;
        values.push(limit);

        query = `
          SELECT *,
            1 - (content_embedding <=> $${embeddingParam}::vector) AS similarity
          FROM unified_documents
          WHERE ${whereClause}
            AND content_embedding IS NOT NULL
            AND 1 - (content_embedding <=> $${embeddingParam}::vector) >= $${minSimilarityParam}
          ORDER BY content_embedding <=> $${embeddingParam}::vector
          LIMIT $${limitParam}::bigint
        `;
      } else {
        // Full-text search fallback
        if (params.query) {
          conditions.push(`to_tsvector('english', title || ' ' || COALESCE(content_text, '')) @@ plainto_tsquery('english', $${paramIndex})`);
          values.push(params.query);
          paramIndex++;
        }

        const limitParam = paramIndex;
        values.push(limit);

        query = `
          SELECT *, 0.5 AS similarity
          FROM unified_documents
          WHERE ${conditions.join(' AND ')}
          ORDER BY created_at DESC
          LIMIT $${limitParam}::bigint
        `;
      }

      const result = await this.pool.query(query, values);

      return result.rows.map(row => ({
        ...this.mapDocument(row),
        similarity: parseFloat(row.similarity) || 0,
      }));
    } catch (error) {
      logger.error('Semantic search failed:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive agent context for a task
   */
  async getAgentContext(params: {
    dealId?: string;
    agentType: string;
    semanticQuery?: string;
    queryEmbedding?: number[];
    filters?: any;
    limit?: number;
  }): Promise<AgentContextResult> {
    try {
      // 1. Semantic search for primary documents
      const primaryDocs = await this.semanticSearch({
        query: params.semanticQuery,
        queryEmbedding: params.queryEmbedding,
        filters: {
          ...params.filters,
          dealCapsuleId: params.dealId,
        },
        limit: params.limit || 10,
        minSimilarity: 0.7,
      });

      // 2. Get related documents
      const supplementalDocs = await this.getRelatedDocuments(
        primaryDocs.map(d => d.id),
        ['supplements', 'derived_from']
      );

      // 3. Find comparable deals (placeholder - needs deal_capsules integration)
      const comparableDeals: any[] = [];

      // 4. Get historical learnings
      const historicalLearnings = await this.getAgentPatterns(params.agentType, params.filters);

      // 5. Extract normalized fields from primary documents
      const normalizedFields = this.extractNormalizedFields(primaryDocs);

      // 6. Aggregate data quality flags
      const dataQualityFlags = primaryDocs
        .flatMap(doc => doc.dataQualityFlags)
        .filter((flag, index, self) => 
          index === self.findIndex(f => f.field === flag.field && f.issue === flag.issue)
        );

      // 7. Calculate overall confidence score
      const avgConfidence = primaryDocs.length > 0
        ? primaryDocs.reduce((sum, doc) => sum + (doc.confidenceScore || 0), 0) / primaryDocs.length
        : 0;

      return {
        primaryDocuments: primaryDocs,
        supplementalDocuments: supplementalDocs,
        comparableDeals,
        historicalLearnings,
        normalizedFields,
        confidenceScore: avgConfidence,
        dataQualityFlags,
      };
    } catch (error) {
      logger.error('Failed to get agent context:', error);
      throw error;
    }
  }

  /**
   * Get related documents by relationship type
   */
  async getRelatedDocuments(
    docIds: string[],
    relationshipTypes?: string[]
  ): Promise<UnifiedDocument[]> {
    try {
      if (docIds.length === 0) return [];

      const conditions = ['parent_doc_id = ANY($1)'];
      const values: any[] = [docIds];

      if (relationshipTypes && relationshipTypes.length > 0) {
        conditions.push('relationship_type = ANY($2)');
        values.push(relationshipTypes);
      }

      const result = await this.pool.query(
        `SELECT ud.*
         FROM doc_relationships dr
         JOIN unified_documents ud ON ud.id = dr.child_doc_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY dr.detected_at DESC`,
        values
      );

      return result.rows.map(this.mapDocument);
    } catch (error) {
      logger.error('Failed to get related documents:', error);
      throw error;
    }
  }

  /**
   * Create a document relationship
   */
  async createDocumentRelationship(rel: Partial<DocumentRelationship>): Promise<DocumentRelationship> {
    try {
      const result = await this.pool.query(
        `INSERT INTO doc_relationships (
          parent_doc_id, child_doc_id, relationship_type, confidence,
          detected_by, metadata, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (parent_doc_id, child_doc_id, relationship_type) DO NOTHING
        RETURNING *`,
        [
          rel.parentDocId,
          rel.childDocId,
          rel.relationshipType,
          rel.confidence,
          rel.detectedBy,
          JSON.stringify(rel.metadata || {}),
          rel.notes,
        ]
      );

      if (result.rows.length === 0) {
        // Relationship already exists
        const existing = await this.pool.query(
          'SELECT * FROM doc_relationships WHERE parent_doc_id = $1 AND child_doc_id = $2 AND relationship_type = $3',
          [rel.parentDocId, rel.childDocId, rel.relationshipType]
        );
        return this.mapRelationship(existing.rows[0]);
      }

      return this.mapRelationship(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create document relationship:', error);
      throw error;
    }
  }

  /**
   * Log agent task learning
   */
  async logAgentLearning(learning: Partial<AgentLearning>): Promise<AgentLearning> {
    try {
      const result = await this.pool.query(
        `INSERT INTO agent_task_learnings (
          agent_type, task_id, deal_capsule_id, context_documents,
          context_summary, context_embedding, input_params, output_result,
          output_confidence, execution_time_ms, data_sources_used, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          learning.agentType,
          learning.taskId,
          learning.dealCapsuleId,
          learning.contextDocuments || [],
          learning.contextSummary,
          learning.contextEmbedding ? `[${learning.contextEmbedding.join(',')}]` : null,
          JSON.stringify(learning.inputParams || {}),
          JSON.stringify(learning.outputResult || {}),
          learning.outputConfidence,
          learning.executionTimeMs,
          learning.dataSourcesUsed || [],
          learning.userId,
        ]
      );

      logger.info('Agent learning logged:', {
        learningId: result.rows[0].id,
        agentType: learning.agentType,
      });

      return this.mapLearning(result.rows[0]);
    } catch (error) {
      logger.error('Failed to log agent learning:', error);
      throw error;
    }
  }

  /**
   * Get agent patterns for context
   */
  private async getAgentPatterns(agentType: string, filters?: any): Promise<any[]> {
    try {
      const result = await this.pool.query(
        `SELECT pattern_name, statistics
         FROM agent_patterns
         WHERE agent_type = $1 AND is_active = true
         ORDER BY confidence DESC
         LIMIT 5`,
        [agentType]
      );

      return result.rows.map(row => ({
        pattern: row.pattern_name,
        statistics: row.statistics,
      }));
    } catch (error) {
      logger.warn('Failed to get agent patterns:', error);
      return [];
    }
  }

  /**
   * Extract normalized fields from documents
   */
  private extractNormalizedFields(docs: UnifiedDocument[]): Record<string, any> {
    const normalized: Record<string, any> = {};

    for (const doc of docs) {
      Object.assign(normalized, doc.structuredData);
    }

    return normalized;
  }

  /**
   * Map database row to UnifiedDocument
   */
  private mapDocument(row: any): UnifiedDocument {
    return {
      id: row.id,
      sourceSystem: row.source_system,
      sourceId: row.source_id,
      externalUrl: row.external_url,
      documentType: row.document_type,
      title: row.title,
      contentText: row.content_text,
      contentEmbedding: row.content_embedding,
      propertyAddress: row.property_address,
      propertyCity: row.property_city,
      propertyState: row.property_state,
      propertyZip: row.property_zip,
      propertyType: row.property_type,
      unitCount: row.unit_count,
      lotSizeSf: row.lot_size_sf,
      yearBuilt: row.year_built,
      dealCapsuleId: row.deal_capsule_id,
      structuredData: row.structured_data || {},
      confidenceScore: row.confidence_score,
      validationStatus: row.validation_status,
      validationNotes: row.validation_notes,
      dataQualityFlags: row.data_quality_flags || [],
      createdByAgent: row.created_by_agent,
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to DocumentRelationship
   */
  private mapRelationship(row: any): DocumentRelationship {
    return {
      id: row.id,
      parentDocId: row.parent_doc_id,
      childDocId: row.child_doc_id,
      relationshipType: row.relationship_type,
      confidence: row.confidence,
      detectedBy: row.detected_by,
      detectedAt: row.detected_at,
      metadata: row.metadata || {},
      notes: row.notes,
    };
  }

  /**
   * Map database row to AgentLearning
   */
  private mapLearning(row: any): AgentLearning {
    return {
      id: row.id,
      agentType: row.agent_type,
      taskId: row.task_id,
      dealCapsuleId: row.deal_capsule_id,
      contextDocuments: row.context_documents || [],
      contextSummary: row.context_summary,
      contextEmbedding: row.context_embedding,
      inputParams: row.input_params || {},
      outputResult: row.output_result || {},
      outputConfidence: row.output_confidence,
      executionTimeMs: row.execution_time_ms,
      dataSourcesUsed: row.data_sources_used || [],
      userValidation: row.user_validation,
      userCorrections: row.user_corrections,
      userFeedbackNotes: row.user_feedback_notes,
      similarTaskIds: row.similar_task_ids,
      similarityScores: row.similarity_scores,
      outcomeStatus: row.outcome_status,
      outcomeNotes: row.outcome_notes,
      userId: row.user_id,
      createdAt: row.created_at,
    };
  }
}
