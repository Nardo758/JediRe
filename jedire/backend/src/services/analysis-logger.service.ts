/**
 * Analysis Logger Service
 * Structured logging for agent analyses with metrics tracking
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';

export interface AnalysisLog {
  dealId?: string;
  dealName?: string;
  agentType: string;
  taskId: string;
  status: 'started' | 'completed' | 'failed';
  executionTimeMs?: number;
  errorMessage?: string;
  inputData?: any;
  outputData?: any;
  metadata?: any;
}

export class AnalysisLoggerService {
  /**
   * Log analysis event
   */
  async logAnalysis(log: AnalysisLog): Promise<void> {
    try {
      await query(
        `INSERT INTO analysis_logs (
          deal_id, deal_name, agent_type, task_id, status,
          execution_time_ms, error_message, input_data, output_data, metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (task_id) DO UPDATE SET
          status = EXCLUDED.status,
          execution_time_ms = EXCLUDED.execution_time_ms,
          error_message = EXCLUDED.error_message,
          output_data = EXCLUDED.output_data,
          updated_at = NOW()`,
        [
          log.dealId || null,
          log.dealName || null,
          log.agentType,
          log.taskId,
          log.status,
          log.executionTimeMs || null,
          log.errorMessage || null,
          JSON.stringify(log.inputData || {}),
          JSON.stringify(log.outputData || {}),
          JSON.stringify(log.metadata || {}),
        ]
      ).catch(() => {
        // Table might not exist yet - fail silently and log to console
        logger.warn('analysis_logs table not found, logging to console only', log);
      });

      logger.info('Analysis logged:', {
        agentType: log.agentType,
        status: log.status,
        executionTimeMs: log.executionTimeMs,
      });
    } catch (error) {
      logger.error('Failed to log analysis:', error);
    }
  }

  /**
   * Get analysis stats for a deal
   */
  async getDealAnalysisStats(dealId: string): Promise<any> {
    try {
      const result = await query(
        `SELECT 
          agent_type,
          COUNT(*) as total_runs,
          COUNT(*) FILTER (WHERE status = 'completed') as successful,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          AVG(execution_time_ms) FILTER (WHERE status = 'completed') as avg_execution_ms,
          MAX(created_at) as last_run_at
         FROM analysis_logs
         WHERE deal_id = $1
         GROUP BY agent_type`,
        [dealId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get deal analysis stats:', error);
      return [];
    }
  }

  /**
   * Get global agent performance metrics
   */
  async getAgentPerformanceMetrics(days = 7): Promise<any> {
    try {
      const result = await query(
        `SELECT 
          agent_type,
          COUNT(*) as total_runs,
          COUNT(*) FILTER (WHERE status = 'completed') as successful,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          AVG(execution_time_ms) FILTER (WHERE status = 'completed') as avg_execution_ms,
          MIN(execution_time_ms) FILTER (WHERE status = 'completed') as min_execution_ms,
          MAX(execution_time_ms) FILTER (WHERE status = 'completed') as max_execution_ms,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms) 
            FILTER (WHERE status = 'completed') as median_execution_ms
         FROM analysis_logs
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY agent_type
         ORDER BY agent_type`,
        []
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get agent performance metrics:', error);
      return [];
    }
  }

  /**
   * Get recent errors
   */
  async getRecentErrors(limit = 20): Promise<any> {
    try {
      const result = await query(
        `SELECT 
          deal_id, deal_name, agent_type, task_id,
          error_message, input_data, created_at
         FROM analysis_logs
         WHERE status = 'failed'
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get recent errors:', error);
      return [];
    }
  }
}
