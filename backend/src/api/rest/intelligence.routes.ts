/**
 * Intelligence Layer API Routes
 * Stats and management endpoints for document intelligence and agent learning
 */

import { Router } from 'express';
import { getPool } from '../../database/connection';

const router = Router();

/**
 * GET /api/v1/intelligence/stats
 * Get overall intelligence layer statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const pool = getPool();

    // Document stats
    const docStats = await pool.query(`
      SELECT 
        COUNT(*) as total_documents,
        COUNT(content_embedding) as documents_with_embeddings,
        COUNT(CASE WHEN validation_status = 'validated' THEN 1 END) as validated_documents,
        COUNT(CASE WHEN validation_status = 'flagged' THEN 1 END) as flagged_documents,
        COUNT(CASE WHEN validation_status = 'pending' THEN 1 END) as pending_validation
      FROM unified_documents
    `);

    // Source breakdown
    const sourceBreakdown = await pool.query(`
      SELECT 
        source_system,
        COUNT(*) as document_count,
        COUNT(content_embedding) as with_embeddings,
        ROUND(COUNT(content_embedding)::numeric * 100.0 / NULLIF(COUNT(*), 0), 1) as pct_embedded
      FROM unified_documents
      GROUP BY source_system
      ORDER BY document_count DESC
    `);

    // Document type breakdown
    const typeBreakdown = await pool.query(`
      SELECT 
        document_type,
        COUNT(*) as count,
        COUNT(content_embedding) as with_embeddings
      FROM unified_documents
      GROUP BY document_type
      ORDER BY count DESC
      LIMIT 10
    `);

    // Agent learning stats (last 30 days)
    const learningStats = await pool.query(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN user_validation = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN user_validation = 'corrected' THEN 1 END) as corrected,
        COUNT(CASE WHEN user_validation = 'rejected' THEN 1 END) as rejected,
        AVG(execution_time_ms) as avg_execution_time,
        AVG(output_confidence) as avg_confidence
      FROM agent_task_learnings
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);

    // Agent type breakdown
    const agentBreakdown = await pool.query(`
      SELECT 
        agent_type,
        COUNT(*) as task_count,
        COUNT(CASE WHEN user_validation = 'approved' THEN 1 END) as approved,
        AVG(output_confidence) as avg_confidence
      FROM agent_task_learnings
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY agent_type
      ORDER BY task_count DESC
    `);

    // Pattern discovery
    const patterns = await pool.query(`
      SELECT 
        COUNT(*) as total_patterns,
        COUNT(CASE WHEN is_active THEN 1 END) as active_patterns,
        AVG(confidence) as avg_pattern_confidence,
        AVG(sample_count) as avg_sample_size
      FROM agent_patterns
    `);

    // Data quality issues
    const qualityIssues = await pool.query(`
      SELECT 
        COUNT(*) as total_flagged,
        COUNT(CASE WHEN data_quality_flags::jsonb @> '[{"severity": "high"}]' THEN 1 END) as high_severity,
        COUNT(CASE WHEN data_quality_flags::jsonb @> '[{"severity": "medium"}]' THEN 1 END) as medium_severity
      FROM unified_documents
      WHERE validation_status = 'flagged'
        AND jsonb_array_length(data_quality_flags::jsonb) > 0
    `);

    // Document relationships
    const relationships = await pool.query(`
      SELECT 
        relationship_type,
        COUNT(*) as count
      FROM doc_relationships
      GROUP BY relationship_type
      ORDER BY count DESC
    `);

    res.json({
      documents: {
        total: parseInt(docStats.rows[0].total_documents),
        withEmbeddings: parseInt(docStats.rows[0].documents_with_embeddings),
        validated: parseInt(docStats.rows[0].validated_documents),
        flagged: parseInt(docStats.rows[0].flagged_documents),
        pendingValidation: parseInt(docStats.rows[0].pending_validation),
        pctEmbedded: docStats.rows[0].total_documents > 0
          ? Math.round((docStats.rows[0].documents_with_embeddings / docStats.rows[0].total_documents) * 100)
          : 0,
      },
      sourceBreakdown: sourceBreakdown.rows.map(row => ({
        source: row.source_system,
        count: parseInt(row.document_count),
        withEmbeddings: parseInt(row.with_embeddings),
        pctEmbedded: parseFloat(row.pct_embedded) || 0,
      })),
      typeBreakdown: typeBreakdown.rows.map(row => ({
        type: row.document_type,
        count: parseInt(row.count),
        withEmbeddings: parseInt(row.with_embeddings),
      })),
      agentLearning: {
        totalTasks: parseInt(learningStats.rows[0].total_tasks) || 0,
        approved: parseInt(learningStats.rows[0].approved) || 0,
        corrected: parseInt(learningStats.rows[0].corrected) || 0,
        rejected: parseInt(learningStats.rows[0].rejected) || 0,
        avgExecutionTime: parseFloat(learningStats.rows[0].avg_execution_time) || 0,
        avgConfidence: parseFloat(learningStats.rows[0].avg_confidence) || 0,
        approvalRate: learningStats.rows[0].total_tasks > 0
          ? Math.round((learningStats.rows[0].approved / learningStats.rows[0].total_tasks) * 100)
          : 0,
      },
      agentBreakdown: agentBreakdown.rows.map(row => ({
        agentType: row.agent_type,
        taskCount: parseInt(row.task_count),
        approved: parseInt(row.approved),
        avgConfidence: parseFloat(row.avg_confidence) || 0,
        approvalRate: row.task_count > 0
          ? Math.round((row.approved / row.task_count) * 100)
          : 0,
      })),
      patterns: {
        total: parseInt(patterns.rows[0]?.total_patterns) || 0,
        active: parseInt(patterns.rows[0]?.active_patterns) || 0,
        avgConfidence: parseFloat(patterns.rows[0]?.avg_pattern_confidence) || 0,
        avgSampleSize: parseFloat(patterns.rows[0]?.avg_sample_size) || 0,
      },
      qualityIssues: {
        total: parseInt(qualityIssues.rows[0]?.total_flagged) || 0,
        highSeverity: parseInt(qualityIssues.rows[0]?.high_severity) || 0,
        mediumSeverity: parseInt(qualityIssues.rows[0]?.medium_severity) || 0,
      },
      relationships: relationships.rows.map(row => ({
        type: row.relationship_type,
        count: parseInt(row.count),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching intelligence stats:', error);
    res.status(500).json({ error: 'Failed to fetch intelligence statistics' });
  }
});

/**
 * GET /api/v1/intelligence/documents/pending
 * Get documents pending embedding generation
 */
router.get('/documents/pending', async (req, res) => {
  try {
    const pool = getPool();
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await pool.query(`
      SELECT 
        id, title, document_type, property_city, property_state,
        source_system, created_at, validation_status
      FROM unified_documents
      WHERE content_embedding IS NULL
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({
      count: result.rows.length,
      documents: result.rows,
    });
  } catch (error: any) {
    console.error('Error fetching pending documents:', error);
    res.status(500).json({ error: 'Failed to fetch pending documents' });
  }
});

/**
 * GET /api/v1/intelligence/documents/flagged
 * Get documents flagged for review
 */
router.get('/documents/flagged', async (req, res) => {
  try {
    const pool = getPool();
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await pool.query(`
      SELECT 
        id, title, document_type, property_city, property_state,
        source_system, data_quality_flags, validation_notes, created_at
      FROM unified_documents
      WHERE validation_status = 'flagged'
        AND jsonb_array_length(data_quality_flags::jsonb) > 0
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({
      count: result.rows.length,
      documents: result.rows,
    });
  } catch (error: any) {
    console.error('Error fetching flagged documents:', error);
    res.status(500).json({ error: 'Failed to fetch flagged documents' });
  }
});

/**
 * GET /api/v1/intelligence/patterns
 * Get discovered patterns
 */
router.get('/patterns', async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT 
        id, agent_type, pattern_name, pattern_description,
        criteria, statistics, confidence, sample_count,
        is_active, last_applied_at, created_at
      FROM agent_patterns
      WHERE is_active = true
      ORDER BY confidence DESC, sample_count DESC
      LIMIT 50
    `);

    res.json({
      count: result.rows.length,
      patterns: result.rows,
    });
  } catch (error: any) {
    console.error('Error fetching patterns:', error);
    res.status(500).json({ error: 'Failed to fetch patterns' });
  }
});

export default router;
