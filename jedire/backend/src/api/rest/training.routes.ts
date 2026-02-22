import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { PatternExtractor } from '../../services/training/pattern-extractor';
import { SuggestionGenerator } from '../../services/training/suggestion-generator';
import {
  UserModuleTraining,
  TrainingExample,
  ModuleSuggestion,
  ModuleType,
} from '../../models/module-training';
import { Suggestion } from '../../services/training/suggestion-generator';

export function createTrainingRoutes(pool: Pool): Router {
  const router = Router();
  const patternExtractor = new PatternExtractor();
  const suggestionGenerator = new SuggestionGenerator();

  /**
   * POST /api/training/examples
   * Upload training examples (from pro formas, past deals)
   */
  router.post('/examples', async (req: Request, res: Response) => {
    try {
      const { training_id, deal_characteristics, user_output, source_type, source_file_name } = req.body as {
        training_id: string;
        deal_characteristics: any;
        user_output: any;
        source_type?: string;
        source_file_name?: string;
      };

      if (!training_id || !deal_characteristics || !user_output) {
        return res.status(400).json({ error: 'Missing required fields: training_id, deal_characteristics, user_output' });
      }

      const result = await pool.query(
        `INSERT INTO training_examples (training_id, deal_characteristics, user_output, source_type, source_file_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [training_id, deal_characteristics, user_output, source_type || 'manual', source_file_name || null]
      );

      res.json({ 
        success: true, 
        example: result.rows[0],
        message: 'Training example added successfully'
      });
    } catch (error) {
      console.error('Error creating training example:', error);
      res.status(500).json({ error: 'Failed to create training example' });
    }
  });

  /**
   * POST /api/training/examples/bulk
   * Bulk upload training examples (e.g., from CSV import)
   */
  router.post('/examples/bulk', async (req: Request, res: Response) => {
    try {
      const { training_id, examples } = req.body;

      if (!training_id || !Array.isArray(examples) || examples.length === 0) {
        return res.status(400).json({ error: 'Invalid bulk upload data' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        const insertedExamples = [];
        for (const example of examples) {
          const result = await client.query(
            `INSERT INTO training_examples (training_id, deal_characteristics, user_output, source_type, source_file_name)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [training_id, example.deal_characteristics, example.user_output, example.source_type || 'manual', example.source_file_name || null]
          );
          insertedExamples.push(result.rows[0]);
        }

        await client.query('COMMIT');
        
        res.json({ 
          success: true, 
          count: insertedExamples.length,
          examples: insertedExamples,
          message: `Successfully uploaded ${insertedExamples.length} training examples`
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error bulk uploading training examples:', error);
      res.status(500).json({ error: 'Failed to bulk upload training examples' });
    }
  });

  /**
   * POST /api/training/extract-patterns
   * Analyze training examples and extract patterns
   */
  router.post('/extract-patterns', async (req: Request, res: Response) => {
    try {
      const { user_id, module_id } = req.body;

      if (!user_id || !module_id) {
        return res.status(400).json({ error: 'Missing required fields: user_id, module_id' });
      }

      const examplesResult = await pool.query(
        `SELECT te.* FROM training_examples te
         JOIN user_module_training umt ON te.training_id = umt.id
         WHERE umt.user_id = $1 AND umt.module_id = $2
         ORDER BY te.created_at DESC`,
        [user_id, module_id]
      );

      if (examplesResult.rows.length === 0) {
        return res.status(400).json({ error: 'No training examples found for this module' });
      }

      const patterns = patternExtractor.extractPatterns(
        module_id as ModuleType,
        examplesResult.rows as TrainingExample[]
      );

      const examples = examplesResult.rows as TrainingExample[];
      const qualityScore = examples.length > 0
        ? examples.reduce((sum, ex) => sum + patternExtractor.calculateQualityScore(ex), 0) / examples.length
        : 0;

      const upsertResult = await pool.query(
        `INSERT INTO user_module_training (user_id, module_id, learned_patterns, sample_size, confidence)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, module_id) 
         DO UPDATE SET 
           learned_patterns = $3,
           sample_size = $4,
           confidence = $5,
           last_trained = NOW()
         RETURNING *`,
        [user_id, module_id, patterns, examplesResult.rows.length, qualityScore]
      );

      res.json({ 
        success: true, 
        training: upsertResult.rows[0],
        patterns,
        quality_score: qualityScore,
        example_count: examplesResult.rows.length
      });
    } catch (error) {
      console.error('Error extracting patterns:', error);
      res.status(500).json({ error: 'Failed to extract patterns' });
    }
  });

  /**
   * POST /api/training/generate-suggestions
   * Generate suggestions for a deal based on learned patterns + calibration
   */
  router.post('/generate-suggestions', async (req: Request, res: Response) => {
    try {
      const { 
        user_id, 
        module_id,
        capsule_id,
        deal_data, 
        platform_intel,
        include_calibration = true 
      } = req.body as {
        user_id: string;
        module_id: string;
        capsule_id: string;
        deal_data: any;
        platform_intel?: any;
        include_calibration?: boolean;
      };

      if (!user_id || !module_id || !deal_data) {
        return res.status(400).json({ error: 'Missing required fields: user_id, module_id, deal_data' });
      }

      const patternsResult = await pool.query(
        `SELECT * FROM user_module_training 
         WHERE user_id = $1 AND module_id = $2`,
        [user_id, module_id]
      );

      if (patternsResult.rows.length === 0) {
        return res.status(400).json({ 
          error: 'No training data found. Please upload training examples first.' 
        });
      }

      const training = patternsResult.rows[0] as UserModuleTraining;

      let calibrationFactors = null;
      if (include_calibration) {
        const calibrationResult = await pool.query(
          `SELECT * FROM calibration_factors 
           WHERE user_id = $1 AND module_id = $2 
           ORDER BY last_updated DESC 
           LIMIT 1`,
          [user_id, module_id]
        );

        if (calibrationResult.rows.length > 0) {
          calibrationFactors = calibrationResult.rows[0];
        }
      }

      const capsuleLike = {
        deal_data: deal_data || {},
        platform_intel: platform_intel || {},
      } as any;

      let suggestions: Suggestion[] = suggestionGenerator.generateSuggestions(
        capsuleLike,
        training,
        module_id as ModuleType
      );

      if (calibrationFactors) {
        suggestions = suggestionGenerator.combineSuggestions(suggestions, calibrationFactors.calibration_data?.noi_factor || null);
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const savedSuggestions = [];
        for (const suggestion of suggestions) {
          const result = await client.query(
            `INSERT INTO module_suggestions 
             (capsule_id, module_id, suggested_field, suggested_value, confidence, suggestion_reason)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
              capsule_id || null,
              module_id,
              suggestion.field,
              suggestion.value,
              suggestion.confidence,
              suggestion.reason
            ]
          );
          savedSuggestions.push(result.rows[0]);
        }

        await client.query('COMMIT');

        res.json({ 
          success: true, 
          suggestions: savedSuggestions,
          pattern_quality: training.confidence,
          calibration_applied: !!calibrationFactors
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
      res.status(500).json({ error: 'Failed to generate suggestions' });
    }
  });

  /**
   * GET /api/training/:userId/:moduleId
   * Get training status for a module
   */
  router.get('/:userId/:moduleId', async (req: Request, res: Response) => {
    try {
      const { userId, moduleId } = req.params;

      const result = await pool.query(
        `SELECT * FROM user_module_training 
         WHERE user_id = $1 AND module_id = $2`,
        [userId, moduleId]
      );

      if (result.rows.length === 0) {
        return res.json({ 
          success: true, 
          trained: false,
          message: 'No training data found for this module'
        });
      }

      res.json({ 
        success: true, 
        trained: true,
        training: result.rows[0]
      });
    } catch (error) {
      console.error('Error fetching training status:', error);
      res.status(500).json({ error: 'Failed to fetch training status' });
    }
  });

  /**
   * GET /api/training/:userId/all
   * Get all module training status for a user
   */
  router.get('/:userId/all', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const result = await pool.query(
        `SELECT module_id, sample_size, confidence, last_trained 
         FROM user_module_training 
         WHERE user_id = $1
         ORDER BY module_id`,
        [userId]
      );

      res.json({ 
        success: true, 
        modules: result.rows
      });
    } catch (error) {
      console.error('Error fetching all training status:', error);
      res.status(500).json({ error: 'Failed to fetch training status' });
    }
  });

  /**
   * PUT /api/training/suggestions/:suggestionId/feedback
   * Record user feedback on a suggestion (accepted/rejected/modified)
   */
  router.put('/suggestions/:suggestionId/feedback', async (req: Request, res: Response) => {
    try {
      const { suggestionId } = req.params;
      const { status, actual_value, feedback_notes } = req.body;

      if (!status || !['accepted', 'rejected', 'modified'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be: accepted, rejected, or modified' });
      }

      const result = await pool.query(
        `UPDATE module_suggestions 
         SET user_response = $1, 
             user_final_value = $2, 
             feedback_notes = $3,
             feedback_timestamp = NOW()
         WHERE id = $4
         RETURNING *`,
        [status, actual_value, feedback_notes, suggestionId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Suggestion not found' });
      }

      res.json({ 
        success: true, 
        suggestion: result.rows[0]
      });
    } catch (error) {
      console.error('Error recording suggestion feedback:', error);
      res.status(500).json({ error: 'Failed to record feedback' });
    }
  });

  /**
   * DELETE /api/training/:userId/:moduleId
   * Reset training for a module (delete all training data)
   */
  router.delete('/:userId/:moduleId', async (req: Request, res: Response) => {
    try {
      const { userId, moduleId } = req.params;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `DELETE FROM user_module_training 
           WHERE user_id = $1 AND module_id = $2`,
          [userId, moduleId]
        );

        await client.query('COMMIT');

        res.json({ 
          success: true, 
          message: `Training data for ${moduleId} has been reset`
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error resetting training:', error);
      res.status(500).json({ error: 'Failed to reset training' });
    }
  });

  return router;
}
