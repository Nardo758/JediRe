/**
 * Global Task Coordinator Service
 * 
 * Central coordinator that wires TASKS to:
 * - Emails (extract action items, link tasks to threads)
 * - Deals (stage transitions, due diligence requirements)
 * - Agents (all 18 agents can create tasks)
 * - Calendar (due dates, reminders)
 * 
 * CREATE: backend/src/services/task-coordinator.service.ts
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { agentAlertService, AgentCode } from './agent-alert.service';

// ============================================================================
// Types
// ============================================================================

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type TaskSource = 
  | 'manual'           // User created
  | 'email_ai'         // Extracted from email
  | 'stage_transition' // Deal stage changed
  | 'agent'            // AI agent recommendation
  | 'system'           // System generated
  | 'calendar'         // Calendar integration
  | 'document';        // Document review required

export interface TaskCreateParams {
  title: string;
  description?: string;
  category: string;
  priority?: TaskPriority;
  dealId?: string;
  propertyId?: string;
  emailId?: string;
  emailThreadId?: string;
  assignedToId?: string;
  createdById?: string;
  dueDate?: Date;
  dueDays?: number;  // Alternative: due in X days
  source: TaskSource;
  sourceRef?: string;
  tags?: string[];
  stageId?: string;
  isStageRequired?: boolean;
  metadata?: Record<string, any>;
}

export interface EmailTaskExtraction {
  emailId: string;
  threadId?: string;
  dealId?: string;
  subject: string;
  from: string;
  tasks: Array<{
    title: string;
    description?: string;
    priority: TaskPriority;
    category: string;
    dueDate?: string;  // ISO string or relative like "next week"
  }>;
}

// ============================================================================
// Task Categories by Context
// ============================================================================

export const TASK_CATEGORIES = {
  // Deal-related
  due_diligence: { label: 'Due Diligence', icon: 'Search', color: '#3498DB' },
  legal: { label: 'Legal', icon: 'Scale', color: '#607D8B' },
  finance: { label: 'Finance', icon: 'DollarSign', color: '#2ECC71' },
  analysis: { label: 'Analysis', icon: 'BarChart', color: '#9B59B6' },
  approval: { label: 'Approval', icon: 'CheckCircle', color: '#E74C3C' },
  environmental: { label: 'Environmental', icon: 'Leaf', color: '#8BC34A' },
  engineering: { label: 'Engineering', icon: 'Tool', color: '#FF9800' },
  
  // Operations
  maintenance: { label: 'Maintenance', icon: 'Wrench', color: '#795548' },
  leasing: { label: 'Leasing', icon: 'Key', color: '#CDDC39' },
  tenant: { label: 'Tenant', icon: 'Users', color: '#4CAF50' },
  vendor: { label: 'Vendor', icon: 'Truck', color: '#FF5722' },
  
  // Communication
  email_followup: { label: 'Email Follow-up', icon: 'Mail', color: '#00BCD4' },
  meeting: { label: 'Meeting', icon: 'Calendar', color: '#673AB7' },
  call: { label: 'Call', icon: 'Phone', color: '#E91E63' },
  document: { label: 'Document', icon: 'FileText', color: '#3F51B5' },
  
  // Other
  research: { label: 'Research', icon: 'BookOpen', color: '#009688' },
  other: { label: 'Other', icon: 'MoreHorizontal', color: '#9E9E9E' },
};

// ============================================================================
// Global Task Coordinator
// ============================================================================

class TaskCoordinatorService {
  
  // ==========================================================================
  // Core Task Operations
  // ==========================================================================

  /**
   * Create a task with full context linking
   */
  async createTask(params: TaskCreateParams): Promise<{ id: string; task: any }> {
    const {
      title,
      description,
      category,
      priority = 'medium',
      dealId,
      propertyId,
      emailId,
      emailThreadId,
      assignedToId,
      createdById,
      dueDate,
      dueDays,
      source,
      sourceRef,
      tags = [],
      stageId,
      isStageRequired = false,
      metadata = {},
    } = params;

    // Calculate due date
    let finalDueDate = dueDate;
    if (!finalDueDate && dueDays) {
      finalDueDate = new Date();
      finalDueDate.setDate(finalDueDate.getDate() + dueDays);
    }

    const result = await query(
      `INSERT INTO tasks (
        title, description, category, priority, status,
        deal_id, property_id, email_id,
        assigned_to_id, created_by_id,
        due_date, source, source_ref, tags,
        stage_id, is_stage_required, metadata
      ) VALUES ($1, $2, $3, $4, 'todo', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        title,
        description || null,
        category,
        priority,
        dealId || null,
        propertyId || null,
        emailId || null,
        assignedToId || null,
        createdById || null,
        finalDueDate || null,
        source,
        sourceRef || null,
        tags,
        stageId || null,
        isStageRequired,
        JSON.stringify({ ...metadata, emailThreadId }),
      ]
    );

    const task = result.rows[0];

    logger.info(`Task created: ${title}`, {
      taskId: task.id,
      source,
      dealId,
      emailId,
    });

    return { id: task.id, task };
  }

  // ==========================================================================
  // Email Integration
  // ==========================================================================

  /**
   * Extract tasks from email content using AI
   * Called after email is processed by email intelligence
   */
  async extractTasksFromEmail(params: EmailTaskExtraction): Promise<{ created: number; tasks: any[] }> {
    const { emailId, threadId, dealId, subject, from, tasks } = params;
    
    const createdTasks: any[] = [];

    for (const taskData of tasks) {
      // Parse relative due dates
      let dueDate: Date | undefined;
      if (taskData.dueDate) {
        dueDate = this.parseRelativeDate(taskData.dueDate);
      }

      const result = await this.createTask({
        title: taskData.title,
        description: `From email: "${subject}" (${from})\n\n${taskData.description || ''}`,
        category: taskData.category || 'email_followup',
        priority: taskData.priority,
        dealId,
        emailId,
        emailThreadId: threadId,
        dueDate,
        source: 'email_ai',
        sourceRef: emailId,
        tags: ['email-extracted'],
        metadata: {
          emailSubject: subject,
          emailFrom: from,
          originalText: taskData.description,
        },
      });

      createdTasks.push(result.task);
    }

    logger.info(`Extracted ${createdTasks.length} tasks from email`, {
      emailId,
      dealId,
    });

    return { created: createdTasks.length, tasks: createdTasks };
  }

  /**
   * Link existing task to email thread
   */
  async linkTaskToEmail(taskId: string, emailId: string, threadId?: string): Promise<void> {
    await query(
      `UPDATE tasks 
       SET email_id = $2, 
           metadata = metadata || $3
       WHERE id = $1`,
      [taskId, emailId, JSON.stringify({ emailThreadId: threadId })]
    );
  }

  /**
   * Get tasks linked to an email thread
   */
  async getTasksForEmailThread(threadId: string): Promise<any[]> {
    const result = await query(
      `SELECT * FROM tasks 
       WHERE metadata->>'emailThreadId' = $1
       ORDER BY created_at DESC`,
      [threadId]
    );
    return result.rows;
  }

  // ==========================================================================
  // Deal Integration
  // ==========================================================================

  /**
   * Generate tasks when deal moves to new stage
   */
  async onDealStageChange(params: {
    dealId: string;
    newStage: string;
    oldStage?: string;
    userId: string;
  }): Promise<{ created: number; tasks: any[] }> {
    const { dealId, newStage, userId } = params;

    // Get deal info
    const dealResult = await query(
      `SELECT name, property_type FROM deals WHERE id = $1`,
      [dealId]
    );
    if (dealResult.rows.length === 0) {
      throw new Error(`Deal not found: ${dealId}`);
    }
    const deal = dealResult.rows[0];

    // Get templates for this stage
    const templateResult = await query(
      `SELECT * FROM stage_task_templates
       WHERE stage_id = $1
         AND (property_type IS NULL OR property_type = $2)
       ORDER BY sequence`,
      [newStage, deal.property_type]
    );

    const createdTasks: any[] = [];
    const now = new Date();

    for (const template of templateResult.rows) {
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + (template.days_from_stage_start || 0));

      const result = await this.createTask({
        title: template.title,
        description: template.description,
        category: template.category,
        priority: template.priority,
        dealId,
        assignedToId: userId,
        dueDate,
        source: 'stage_transition',
        sourceRef: newStage,
        stageId: newStage,
        isStageRequired: template.is_required,
        metadata: {
          templateId: template.id,
          dealName: deal.name,
        },
      });

      createdTasks.push(result.task);
    }

    logger.info(`Created ${createdTasks.length} tasks for stage transition`, {
      dealId,
      stage: newStage,
    });

    return { created: createdTasks.length, tasks: createdTasks };
  }

  /**
   * Check if deal can advance to next stage (all required tasks complete)
   */
  async canAdvanceStage(dealId: string, currentStage: string): Promise<{
    canAdvance: boolean;
    blockers: any[];
    completed: number;
    total: number;
  }> {
    const result = await query(
      `SELECT 
        id, title, status, is_stage_required
       FROM tasks
       WHERE deal_id = $1 
         AND stage_id = $2
         AND is_stage_required = TRUE`,
      [dealId, currentStage]
    );

    const tasks = result.rows;
    const completed = tasks.filter(t => t.status === 'done').length;
    const blockers = tasks.filter(t => t.status !== 'done');

    return {
      canAdvance: blockers.length === 0,
      blockers,
      completed,
      total: tasks.length,
    };
  }

  /**
   * Get all tasks for a deal organized by stage
   */
  async getDealTasks(dealId: string): Promise<Record<string, any[]>> {
    const result = await query(
      `SELECT * FROM tasks
       WHERE deal_id = $1
       ORDER BY 
         CASE priority 
           WHEN 'urgent' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'medium' THEN 3 
           WHEN 'low' THEN 4 
         END,
         due_date ASC NULLS LAST`,
      [dealId]
    );

    // Group by stage
    const byStage: Record<string, any[]> = {
      unassigned: [],
    };

    for (const task of result.rows) {
      const stage = task.stage_id || 'unassigned';
      if (!byStage[stage]) {
        byStage[stage] = [];
      }
      byStage[stage].push(task);
    }

    return byStage;
  }

  // ==========================================================================
  // Agent Integration
  // ==========================================================================

  /**
   * Create task from any of the 18 agents
   */
  async createAgentTask(params: {
    agentCode: AgentCode;
    dealId?: string;
    userId: string;
    title: string;
    description?: string;
    category: string;
    priority?: TaskPriority;
    dueDays?: number;
    createAlert?: boolean;  // Also create an alert
  }): Promise<{ taskId: string; alertId?: string }> {
    const {
      agentCode,
      dealId,
      userId,
      title,
      description,
      category,
      priority = 'medium',
      dueDays = 3,
      createAlert = false,
    } = params;

    // Create task
    const taskResult = await this.createTask({
      title,
      description,
      category,
      priority,
      dealId,
      assignedToId: userId,
      dueDays,
      source: 'agent',
      sourceRef: agentCode,
      tags: [`from-${agentCode.toLowerCase()}`],
      metadata: { agentCode },
    });

    let alertId: string | undefined;

    // Optionally create alert
    if (createAlert) {
      const alertResult = await agentAlertService.createAlert({
        dealId,
        userId,
        agentCode,
        alertType: 'action_required',
        severity: priority === 'urgent' ? 'critical' : priority === 'high' ? 'high' : 'medium',
        title: `Task: ${title}`,
        message: description || title,
        suggestedActions: ['Complete the task', 'View task details'],
        data: { taskId: taskResult.id },
      });
      alertId = alertResult.id;
    }

    return { taskId: taskResult.id, alertId };
  }

  /**
   * Bulk create tasks from agent analysis
   */
  async createAgentTasksBulk(
    agentCode: AgentCode,
    userId: string,
    tasks: Array<{
      dealId?: string;
      title: string;
      description?: string;
      category: string;
      priority?: TaskPriority;
      dueDays?: number;
    }>
  ): Promise<{ created: number; taskIds: string[] }> {
    const taskIds: string[] = [];

    for (const task of tasks) {
      const result = await this.createAgentTask({
        agentCode,
        userId,
        ...task,
      });
      taskIds.push(result.taskId);
    }

    return { created: taskIds.length, taskIds };
  }

  // ==========================================================================
  // Task Status & Completion
  // ==========================================================================

  /**
   * Update task status with automatic email notification
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    userId: string,
    note?: string
  ): Promise<any> {
    const updates: string[] = ['status = $2'];
    const params: any[] = [taskId, status];
    let paramIndex = 3;

    if (status === 'done') {
      updates.push('completed_at = NOW()');
    }

    if (note) {
      updates.push(`metadata = metadata || $${paramIndex}`);
      params.push(JSON.stringify({ statusNote: note, updatedBy: userId }));
      paramIndex++;
    }

    const result = await query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const task = result.rows[0];

    // If task was linked to email, we could send a reply
    // (implementation depends on email service)

    logger.info(`Task status updated: ${task.title}`, {
      taskId,
      status,
      dealId: task.deal_id,
    });

    return task;
  }

  /**
   * Mark task as blocked with reason
   */
  async blockTask(taskId: string, reason: string, userId: string): Promise<any> {
    const result = await query(
      `UPDATE tasks 
       SET status = 'blocked', 
           blocked_reason = $2,
           metadata = metadata || $3
       WHERE id = $1 
       RETURNING *`,
      [taskId, reason, JSON.stringify({ blockedBy: userId, blockedAt: new Date() })]
    );

    return result.rows[0];
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Parse relative date strings like "next week", "in 3 days", "Friday"
   */
  private parseRelativeDate(dateStr: string): Date | undefined {
    const now = new Date();
    const lower = dateStr.toLowerCase().trim();

    // Handle "in X days"
    const inDaysMatch = lower.match(/in (\d+) days?/);
    if (inDaysMatch) {
      const days = parseInt(inDaysMatch[1]);
      const date = new Date(now);
      date.setDate(date.getDate() + days);
      return date;
    }

    // Handle "next week"
    if (lower === 'next week') {
      const date = new Date(now);
      date.setDate(date.getDate() + 7);
      return date;
    }

    // Handle "tomorrow"
    if (lower === 'tomorrow') {
      const date = new Date(now);
      date.setDate(date.getDate() + 1);
      return date;
    }

    // Handle "end of week"
    if (lower === 'end of week' || lower === 'eow') {
      const date = new Date(now);
      const daysUntilFriday = (5 - date.getDay() + 7) % 7;
      date.setDate(date.getDate() + (daysUntilFriday || 7));
      return date;
    }

    // Handle "end of month"
    if (lower === 'end of month' || lower === 'eom') {
      const date = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return date;
    }

    // Try ISO date
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    return undefined;
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(userId: string): Promise<any[]> {
    const result = await query(
      `SELECT t.*, d.name as deal_name
       FROM tasks t
       LEFT JOIN deals d ON t.deal_id = d.id
       WHERE (t.assigned_to_id = $1 OR t.assigned_to_id IS NULL)
         AND t.due_date < NOW()
         AND t.status NOT IN ('done', 'cancelled')
       ORDER BY t.due_date ASC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Get tasks due today
   */
  async getTasksDueToday(userId: string): Promise<any[]> {
    const result = await query(
      `SELECT t.*, d.name as deal_name
       FROM tasks t
       LEFT JOIN deals d ON t.deal_id = d.id
       WHERE (t.assigned_to_id = $1 OR t.assigned_to_id IS NULL)
         AND t.due_date::date = CURRENT_DATE
         AND t.status NOT IN ('done', 'cancelled')
       ORDER BY t.priority, t.due_date ASC`,
      [userId]
    );
    return result.rows;
  }
}

export const taskCoordinatorService = new TaskCoordinatorService();
export default taskCoordinatorService;
