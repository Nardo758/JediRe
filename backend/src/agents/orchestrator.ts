/**
 * Agent Orchestration Framework
 * Manages task queue and agent execution
 */

import { query, transaction } from '../database/connection';
import { logger } from '../utils/logger';
import { ZoningAgent } from './zoning.agent';
import { SupplyAgent } from './supply.agent';
import { CashFlowAgent } from './cashflow.agent';

interface TaskInput {
  taskType: string;
  inputData: any;
  userId: string;
  priority?: number;
}

interface Task {
  id: string;
  taskType: string;
  inputData: any;
  status: string;
  userId: string;
}

export class AgentOrchestrator {
  private isProcessing = false;
  private agents: Map<string, any> = new Map();

  constructor() {
    // Register agents
    this.agents.set('zoning_analysis', new ZoningAgent());
    this.agents.set('supply_analysis', new SupplyAgent());
    this.agents.set('cashflow_analysis', new CashFlowAgent());

    // Start processing loop
    this.startProcessingLoop();
  }

  /**
   * Submit a new task to the queue
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

      // Trigger processing
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
   * Start the task processing loop
   */
  private startProcessingLoop(): void {
    setInterval(() => {
      if (!this.isProcessing) {
        this.processNextTask();
      }
    }, 5000); // Check every 5 seconds

    logger.info('Agent orchestrator processing loop started');
  }

  /**
   * Process the next pending task
   */
  private async processNextTask(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    try {
      this.isProcessing = true;

      // Get next pending task (highest priority first)
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

      const task = result.rows[0];

      // Process the task
      await this.executeTask(task);

    } catch (error) {
      logger.error('Error processing task:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a specific task
   */
  private async executeTask(task: any): Promise<void> {
    const taskId = task.id;
    const taskType = task.task_type;
    const startTime = Date.now();

    try {
      logger.info('Executing task:', { taskId, taskType });

      // Update status to processing
      await query(
        `UPDATE agent_tasks
         SET status = 'processing', started_at = NOW()
         WHERE id = $1`,
        [taskId]
      );

      // Get the appropriate agent
      const agent = this.agents.get(taskType);

      if (!agent) {
        throw new Error(`No agent registered for task type: ${taskType}`);
      }

      // Execute the agent
      const result = await agent.execute(task.input_data, task.user_id);

      const executionTime = Date.now() - startTime;

      // Update task with success
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

      logger.info('Task completed:', {
        taskId,
        taskType,
        executionTime: `${executionTime}ms`,
      });

    } catch (error: any) {
      logger.error('Task execution failed:', {
        taskId,
        taskType,
        error: error.message,
      });

      const executionTime = Date.now() - startTime;

      // Update task with failure
      await query(
        `UPDATE agent_tasks
         SET status = 'failed',
             error_message = $1,
             completed_at = NOW(),
             execution_time_ms = $2,
             retry_count = retry_count + 1
         WHERE id = $3`,
        [error.message, executionTime, taskId]
      );

      // Retry logic
      const retryResult = await query(
        'SELECT retry_count, max_retries FROM agent_tasks WHERE id = $1',
        [taskId]
      );

      const { retry_count, max_retries } = retryResult.rows[0];

      if (retry_count < max_retries) {
        // Reschedule with exponential backoff
        const delaySeconds = Math.pow(2, retry_count) * 60; // 1min, 2min, 4min, etc.
        await query(
          `UPDATE agent_tasks
           SET status = 'pending',
               scheduled_at = NOW() + INTERVAL '${delaySeconds} seconds'
           WHERE id = $1`,
          [taskId]
        );

        logger.info('Task scheduled for retry:', {
          taskId,
          retryCount: retry_count,
          delaySeconds,
        });
      }
    }
  }

  /**
   * Get task status
   */
  async getTaskStatus(taskId: string): Promise<any> {
    const result = await query('SELECT * FROM agent_tasks WHERE id = $1', [taskId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Cancel a task
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
}
