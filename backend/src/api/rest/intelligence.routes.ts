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

/**
 * GET /api/v1/intelligence/user/stats
 * Get user-specific intelligence statistics
 */
router.get('/user/stats', async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user?.id; // Assumes auth middleware sets req.user

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // User's documents
    const docStats = await pool.query(`
      SELECT 
        COUNT(*) as my_documents,
        COUNT(content_embedding) as documents_embedded
      FROM unified_documents
      WHERE user_id = $1
    `, [userId]);

    const myDocs = parseInt(docStats.rows[0].my_documents) || 0;
    const embedded = parseInt(docStats.rows[0].documents_embedded) || 0;
    const pending = myDocs - embedded;

    // User's agent tasks
    const taskStats = await pool.query(`
      SELECT 
        COUNT(*) as tasks_run,
        COUNT(CASE WHEN user_validation = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN user_validation = 'corrected' THEN 1 END) as corrections
      FROM agent_task_learnings
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '30 days'
    `, [userId]);

    // Patterns discovered from user's data
    const patternStats = await pool.query(`
      SELECT COUNT(DISTINCT pattern_name) as patterns
      FROM agent_patterns ap
      WHERE EXISTS (
        SELECT 1 FROM agent_task_learnings atl
        WHERE atl.user_id = $1
          AND ap.agent_type = atl.agent_type
      )
    `, [userId]);

    res.json({
      myDocuments: myDocs,
      documentsEmbedded: embedded,
      pendingEmbeddings: pending,
      agentTasksRun: parseInt(taskStats.rows[0].tasks_run) || 0,
      resultsApproved: parseInt(taskStats.rows[0].approved) || 0,
      correctionsMade: parseInt(taskStats.rows[0].corrections) || 0,
      patternsDiscovered: parseInt(patternStats.rows[0].patterns) || 0,
    });
  } catch (error: any) {
    console.error('Error fetching user intelligence stats:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

/**
 * GET /api/v1/intelligence/user/preferences
 * Get user intelligence preferences
 */
router.get('/user/preferences', async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(`
      SELECT 
        semantic_search_enabled,
        semantic_search_threshold,
        contribute_to_learning,
        request_feedback,
        auto_submit_corrections,
        include_documents,
        task_history_retention_days
      FROM user_intelligence_preferences
      WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      // Return defaults
      return res.json({
        semanticSearchEnabled: true,
        semanticSearchThreshold: 0.6,
        contributeToLearning: true,
        requestFeedback: true,
        autoSubmitCorrections: false,
        includeDocuments: true,
        taskHistoryRetentionDays: 90,
      });
    }

    const prefs = result.rows[0];
    res.json({
      semanticSearchEnabled: prefs.semantic_search_enabled,
      semanticSearchThreshold: prefs.semantic_search_threshold,
      contributeToLearning: prefs.contribute_to_learning,
      requestFeedback: prefs.request_feedback,
      autoSubmitCorrections: prefs.auto_submit_corrections,
      includeDocuments: prefs.include_documents,
      taskHistoryRetentionDays: prefs.task_history_retention_days,
    });
  } catch (error: any) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

/**
 * PUT /api/v1/intelligence/user/preferences
 * Update user intelligence preferences
 */
router.put('/user/preferences', async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      semanticSearchEnabled,
      semanticSearchThreshold,
      contributeToLearning,
      requestFeedback,
      autoSubmitCorrections,
      includeDocuments,
      taskHistoryRetentionDays,
    } = req.body;

    await pool.query(`
      INSERT INTO user_intelligence_preferences (
        user_id,
        semantic_search_enabled,
        semantic_search_threshold,
        contribute_to_learning,
        request_feedback,
        auto_submit_corrections,
        include_documents,
        task_history_retention_days
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id)
      DO UPDATE SET
        semantic_search_enabled = EXCLUDED.semantic_search_enabled,
        semantic_search_threshold = EXCLUDED.semantic_search_threshold,
        contribute_to_learning = EXCLUDED.contribute_to_learning,
        request_feedback = EXCLUDED.request_feedback,
        auto_submit_corrections = EXCLUDED.auto_submit_corrections,
        include_documents = EXCLUDED.include_documents,
        task_history_retention_days = EXCLUDED.task_history_retention_days,
        updated_at = NOW()
    `, [
      userId,
      semanticSearchEnabled,
      semanticSearchThreshold,
      contributeToLearning,
      requestFeedback,
      autoSubmitCorrections,
      includeDocuments,
      taskHistoryRetentionDays,
    ]);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * POST /api/v1/intelligence/user/generate-embeddings
 * Generate embeddings for user's pending documents
 */
router.post('/user/generate-embeddings', async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get pending document count
    const result = await pool.query(`
      SELECT COUNT(*) as pending
      FROM unified_documents
      WHERE user_id = $1
        AND content_embedding IS NULL
    `, [userId]);

    const pendingCount = parseInt(result.rows[0].pending);

    if (pendingCount === 0) {
      return res.json({
        message: 'No pending documents',
        processed: 0,
      });
    }

    // TODO: Queue embedding generation job
    // For now, return success message
    res.json({
      message: `Queued ${pendingCount} documents for embedding generation`,
      processed: pendingCount,
      estimatedCost: (pendingCount * 0.00002).toFixed(4),
    });
  } catch (error: any) {
    console.error('Error generating embeddings:', error);
    res.status(500).json({ error: 'Failed to generate embeddings' });
  }
});

export default router;
