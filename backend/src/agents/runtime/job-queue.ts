/**
 * Agent Job Queue
 *
 * Manages the `agent_tasks` table: submission, polling, execution, retry, and
 * learning-log emission.  This is the REST/legacy path for task dispatch.
 * Event-driven execution uses the individual Inngest functions directly.
 *
 * Task-type routing uses TASK_TYPE_RUNTIME_MAP from coordinator/dispatch.ts
 * so the mapping is a single source of truth.
 */

import { query, getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { IntelligenceContextService } from '../../services/intelligence-context.service';
import { MetricRecommendationService } from '../../services/metricRecommendation.service';
import type { MetricRecommendationInput } from '../../services/metricRecommendation.service';
import { TASK_TYPE_RUNTIME_MAP } from '../../coordinator/dispatch';

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

export class AgentJobQueue {
  private isProcessing = false;
  private readonly intelligenceService: IntelligenceContextService;
  private readonly metricRecommendationService = new MetricRecommendationService();

  constructor() {
    this.intelligenceService = new IntelligenceContextService(getPool());
    this.startProcessingLoop();
  }

  async submitTask(input: TaskInput): Promise<Task> {
    try {
      const result = await query(
        `INSERT INTO agent_tasks (
          task_type, input_data, user_id, priority, status
        ) VALUES ($1, $2, $3, $4, 'pending')
        RETURNING *`,
        [input.taskType, JSON.stringify(input.inputData), input.userId, input.priority ?? 0]
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

  async getTaskStatus(taskId: string): Promise<unknown> {
    const result = await query('SELECT * FROM agent_tasks WHERE id = $1', [taskId]);
    return result.rows.length === 0 ? null : result.rows[0];
  }

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

  private startProcessingLoop(): void {
    setInterval(() => {
      if (!this.isProcessing) {
        this.processNextTask();
      }
    }, 5000);

    logger.info('AgentJobQueue: processing loop started');
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

  private async executeTask(task: Record<string, unknown>): Promise<void> {
    const taskId = task.id as string;
    const taskType = task.task_type as string;
    const inputData = (task.input_data as Record<string, unknown>) ?? {};
    const userId = task.user_id as string;
    const startTime = Date.now();

    try {
      logger.info('Executing task:', { taskId, taskType });

      await query(
        `UPDATE agent_tasks SET status = 'processing', started_at = NOW() WHERE id = $1`,
        [taskId]
      );

      let result: unknown;

      const runtime = TASK_TYPE_RUNTIME_MAP[taskType];
      if (runtime) {
        const dealId = (inputData.dealId ?? inputData.deal_id) as string | undefined;
        result = await runtime.run(inputData, {
          dealId,
          userId,
          triggeredBy: 'user',
          triggerContext: { source: 'job-queue', task_type: taskType },
        });

        if (taskType === 'commentary_generation') {
          const out = result as { entity_type?: string; entity_id?: string; [k: string]: unknown };
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
              logger.warn('JobQueue: failed to cache commentary result', { error: err });
            });
          }
        }
      } else if (taskType === 'metric_recommendations') {
        result = await this.metricRecommendationService.execute(
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
