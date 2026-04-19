/**
 * Agent Orchestrator — Shim (Phase 4 Refactor)
 *
 * This class is a thin shim that manages the agent_tasks job queue and
 * routes execution to the AgentRuntime singletons registered in the
 * coordinator dispatch table.
 *
 * Phase 4 changes:
 *   - Removed the agents Map with ZoningAgent/SupplyAgent/CashFlowAgent/CommentaryAgent class instances
 *   - executeTask() now routes via AGENT_RUNTIME_MAP to the appropriate runtime
 *   - Retry logic, task queue, and logAgentLearning() are unchanged
 *
 * task_type → runtime mapping:
 *   'zoning_analysis'       → zoningRuntime.run()
 *   'supply_analysis'       → supplyRuntime.run()
 *   'cashflow_analysis'     → cashflowRuntime.run()
 *   'research_analysis'     → researchRuntime.run()
 *   'commentary_generation' → CommentaryAgent (rich orchestration, not pure runtime)
 *   'metric_recommendations'→ MetricRecommendationAgent (unchanged)
 */

import { query, getPool } from '../database/connection';
import { logger } from '../utils/logger';
import { IntelligenceContextService } from '../services/intelligence-context.service';
import { MetricRecommendationAgent } from './metric-recommendation.agent';
import type { MetricRecommendationInput } from '../services/metricRecommendation.service';
import type { AgentRuntime } from './runtime/AgentRuntime';

// AgentRuntime singletons — loaded lazily to avoid circular imports at startup
import { researchRuntime } from './research.config';
import { zoningRuntime } from './zoning.config';
import { supplyRuntime } from './supply.config';
import { cashflowRuntime } from './cashflow.config';
import { commentaryRuntime } from './commentary.config';

// ── Task queue types ──────────────────────────────────────────────

interface TaskInput {
  taskType: string;
  inputData: Record<string, unknown>;
  userId: string;
  priority?: number;
}

interface Task {
  id: string;
  taskType: string;
  inputData: Record<string, unknown>;
  status: string;
  userId: string;
}


// ── Runtime dispatch map ──────────────────────────────────────────

const AGENT_RUNTIME_MAP: Record<string, AgentRuntime> = {
  research_analysis: researchRuntime,
  zoning_analysis: zoningRuntime,
  supply_analysis: supplyRuntime,
  cashflow_analysis: cashflowRuntime,
  commentary_generation: commentaryRuntime,
};

// ── Orchestrator Shim ─────────────────────────────────────────────

export class AgentOrchestrator {
  private isProcessing = false;
  private intelligenceService: IntelligenceContextService;

  // Only legacy agent: metric_recommendations. Commentary now routes via AGENT_RUNTIME_MAP.
  private readonly metricRecommendationAgent = new MetricRecommendationAgent();

  constructor() {
    this.intelligenceService = new IntelligenceContextService(getPool());
    this.startProcessingLoop();
  }

  /**
   * Submit a new task to the queue.
   */
  async submitTask(input: TaskInput): Promise<Task> {
    try {
      const result = await query(
        `INSERT INTO agent_tasks (
          task_type, input_data, user_id, priority, status
        ) VALUES ($1, $2, $3, $4, 'pending')
        RETURNING *`,
        [input.taskType, JSON.stringify(input.inputData), input.userId, input.priority || 0]
      );

      const task = result.rows[0];

      logger.info('Task submitted:', {
        taskId: task.id,
        taskType: task.task_type,
        userId: input.userId,
      });

      this.processNextTask();

      return {
        id: task.id,
        taskType: task.task_type,
        inputData: task.input_data,
        status: task.status,
        userId: task.user_id,
      };
    } catch (error) {
      logger.error('Failed to submit task:', error);
      throw error;
    }
  }

  /**
   * Get task status by ID.
   */
  async getTaskStatus(taskId: string): Promise<unknown> {
    const result = await query('SELECT * FROM agent_tasks WHERE id = $1', [taskId]);
    return result.rows.length === 0 ? null : result.rows[0];
  }

  /**
   * Cancel a pending or processing task.
   */
  async cancelTask(taskId: string, userId: string): Promise<boolean> {
    const result = await query(
      `UPDATE agent_tasks
       SET status = 'cancelled', completed_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'processing')
       RETURNING id`,
      [taskId, userId]
    );
    return result.rows.length > 0;
  }

  // ── Private: processing loop ──────────────────────────────────

  private startProcessingLoop(): void {
    setInterval(() => {
      if (!this.isProcessing) {
        this.processNextTask();
      }
    }, 5000);

    logger.info('AgentOrchestrator shim: processing loop started');
  }

  private async processNextTask(): Promise<void> {
    if (this.isProcessing) return;

    try {
      this.isProcessing = true;

      const result = await query(
        `SELECT * FROM agent_tasks
         WHERE status = 'pending'
         ORDER BY priority DESC, scheduled_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`
      );

      if (result.rows.length === 0) {
        this.isProcessing = false;
        return;
      }

      await this.executeTask(result.rows[0]);
    } catch (error) {
      logger.error('Error processing task:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a task by routing to the appropriate AgentRuntime or legacy agent.
   *
   * Priority order:
   *  1. AGENT_RUNTIME_MAP  — Phase 4 runtimes: research, zoning, supply, cashflow, commentary_generation
   *  2. legacyAgents       — metric_recommendations (deprecated service shim)
   */
  private async executeTask(task: Record<string, unknown>): Promise<void> {
    const taskId = task.id as string;
    const taskType = task.task_type as string;
    const inputData = (task.input_data as Record<string, unknown>) || {};
    const userId = task.user_id as string;
    const startTime = Date.now();

    try {
      logger.info('Executing task:', { taskId, taskType });

      await query(
        `UPDATE agent_tasks SET status = 'processing', started_at = NOW() WHERE id = $1`,
        [taskId]
      );

      let result: unknown;

      const runtime = AGENT_RUNTIME_MAP[taskType];
      if (runtime) {
        // Phase 4: Route through AgentRuntime
        const runCtx = {
          dealId: inputData.dealId as string | undefined,
          userId,
          triggeredBy: 'user' as const,
          triggerContext: { source: 'orchestrator', task_type: taskType },
        };
        result = await runtime.run(inputData, runCtx);

        // commentary_generation: persist output to market_commentary (authoritative cache)
        if (taskType === 'commentary_generation') {
          const out = result as {
            entity_type?: string;
            entity_id?: string;
            [key: string]: unknown;
          };
          if (out.entity_type && out.entity_id) {
            await query(
              `INSERT INTO market_commentary
                 (entity_type, entity_id, tab_context, commentary, cache_expires_at)
               VALUES ($1, $2, 'commentary', $3, NOW() + INTERVAL '24 hours')
               ON CONFLICT (entity_type, entity_id, tab_context)
               DO UPDATE SET commentary = EXCLUDED.commentary,
                             cache_expires_at = EXCLUDED.cache_expires_at`,
              [out.entity_type, out.entity_id, JSON.stringify(out)]
            ).catch((err) => {
              logger.warn('Orchestrator: failed to cache commentary result', { error: err });
            });
          }
        }
      } else if (taskType === 'metric_recommendations') {
        // Only remaining legacy path — typed directly to avoid unsafe casts
        result = await this.metricRecommendationAgent.execute(
          inputData as unknown as MetricRecommendationInput,
          userId,
        );
      } else {
        throw new Error(`No runtime registered for task type: ${taskType}`);
      }

      const executionTime = Date.now() - startTime;

      await query(
        `UPDATE agent_tasks
         SET status = 'completed',
             output_data = $1,
             completed_at = NOW(),
             execution_time_ms = $2,
             progress = 100
         WHERE id = $3`,
        [JSON.stringify(result), executionTime, taskId]
      );

      logger.info('Task completed:', { taskId, taskType, executionTime: `${executionTime}ms` });

      this.logAgentLearning(task, result, executionTime).catch(err => {
        logger.warn('Failed to log agent learning:', err);
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Task execution failed:', { taskId, taskType, error: msg });

      const executionTime = Date.now() - startTime;

      await query(
        `UPDATE agent_tasks
         SET status = 'failed',
             error_message = $1,
             completed_at = NOW(),
             execution_time_ms = $2,
             retry_count = retry_count + 1
         WHERE id = $3`,
        [msg, executionTime, taskId]
      );

      // Retry with exponential backoff
      const retryResult = await query(
        'SELECT retry_count, max_retries FROM agent_tasks WHERE id = $1',
        [taskId]
      );
      const { retry_count, max_retries } = retryResult.rows[0];

      if (retry_count < max_retries) {
        const delaySeconds = Math.pow(2, retry_count) * 60;
        await query(
          `UPDATE agent_tasks
           SET status = 'pending',
               scheduled_at = NOW() + INTERVAL '${delaySeconds} seconds'
           WHERE id = $1`,
          [taskId]
        );
        logger.info('Task scheduled for retry:', { taskId, retryCount: retry_count, delaySeconds });
      }
    }
  }

  private async logAgentLearning(
    task: Record<string, unknown>,
    outputResult: unknown,
    executionTimeMs: number
  ): Promise<void> {
    try {
      const output = outputResult as Record<string, unknown> | null | undefined;
      const outputConfidence = output?.confidence ?? output?.confidence_score;
      const inputData = task.input_data as Record<string, unknown>;

      const dataSources = ['agent_tasks'];
      if (inputData?.dealId) dataSources.push('deal_capsules');

      await this.intelligenceService.logAgentLearning({
        agentType: task.task_type as string,
        taskId: task.id as string,
        dealCapsuleId: inputData?.dealId as string | undefined,
        contextDocuments: [],
        inputParams: inputData || {},
        outputResult: output || {},
        outputConfidence: outputConfidence as number | undefined,
        executionTimeMs,
        dataSourcesUsed: dataSources,
        userId: task.user_id as string,
      });

      logger.debug('Agent learning logged:', { taskId: task.id, agentType: task.task_type });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to log agent learning:', { taskId: task.id, error: msg });
      throw error;
    }
  }
}
