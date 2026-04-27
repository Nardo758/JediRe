/**
 * Agent Orchestrator
 * 
 * Central coordinator for autonomous agent operations:
 * - Routes user requests to appropriate agents
 * - Dispatches events to trigger agent workflows
 * - Manages multi-agent conversations
 * - Handles agent notifications
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import Anthropic from '@anthropic-ai/sdk';
import { 
  AGENT_PERSONAS, 
  AgentPersona, 
  TriggerEvent,
  getAgentById,
  getAgentsByTrigger,
} from './agent-personas';
import { skillRegistry } from '../skills/skill-registry';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface AgentContext {
  userId: string;
  dealId?: string;
  msaId?: string;
  conversationId?: string;
  triggerEvent?: TriggerEvent;
  triggerData?: Record<string, any>;
}

export interface AgentRequest {
  message?: string;
  agentId?: string;  // Specific agent to route to, or orchestrator picks
  context: AgentContext;
}

export interface AgentResponse {
  agentId: string;
  agentName: string;
  message: string;
  skillsUsed: string[];
  followUpAgents?: string[];  // Agents that should also look at this
  notifications?: AgentNotification[];
  conversationId: string;
}

export interface AgentNotification {
  type: 'info' | 'warning' | 'alert' | 'action_required';
  title: string;
  message: string;
  agentId: string;
  dealId?: string;
  channels: ('in_app' | 'email' | 'slack' | 'webhook')[];
  actionUrl?: string;
}

export interface EventPayload {
  event: TriggerEvent;
  dealId?: string;
  userId?: string;
  data: Record<string, any>;
  /** Set by event-dispatcher after logging — links agent_workflow_runs rows. */
  eventId?: string;
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// AGENT ORCHESTRATOR CLASS
// ============================================================================

class AgentOrchestrator {
  
  /**
   * Process a user request - routes to appropriate agent(s)
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const { message, agentId, context } = request;
    const convId = context.conversationId || this.generateConversationId();

    // Determine which agent should handle this
    let agent: AgentPersona;
    
    if (agentId) {
      // User specified an agent
      agent = getAgentById(agentId) || getAgentById('orchestrator')!;
    } else if (message) {
      // Route based on message content
      agent = await this.routeToAgent(message, context);
    } else {
      agent = getAgentById('orchestrator')!;
    }

    logger.info(`Routing to agent: ${agent.id}`, { message: message?.slice(0, 100), dealId: context.dealId });

    // Get the agent's allowed skills
    const allowedSkills = this.getAgentSkills(agent);

    // Build the conversation
    const response = await this.runAgentConversation(agent, message || '', context, allowedSkills, convId);

    return response;
  }

  /**
   * Dispatch an event to trigger relevant agents
   */
  async dispatchEvent(payload: EventPayload): Promise<AgentResponse[]> {
    const { event, dealId, userId, data, eventId } = payload;
    
    logger.info(`Dispatching event: ${event}`, { dealId, data });

    // Find all agents that care about this event
    const agents = getAgentsByTrigger(event);
    
    if (agents.length === 0) {
      logger.info(`No agents registered for event: ${event}`);
      return [];
    }

    const responses: AgentResponse[] = [];
    const context: AgentContext = {
      userId: userId || 'system',
      dealId,
      triggerEvent: event,
      triggerData: data,
    };

    // Process each agent (in priority order)
    for (const agent of agents) {
      // Check if agent's trigger conditions are met
      const trigger = agent.triggers.find(t => t.event === event);
      if (!trigger) continue;

      if (trigger.conditions && !this.checkConditions(trigger.conditions, data)) {
        continue;
      }

      // Skip non-autonomous agents for background events
      if (!agent.canWorkAutonomously && !userId) {
        continue;
      }

      // Find the pending workflow_run row pre-created by the dispatcher (if any)
      const runId = await this.findRunId(eventId, agent.id);
      await this.markRun(runId, 'running');

      try {
        const prompt = this.buildEventPrompt(agent, trigger, data);
        const allowedSkills = this.getAgentSkills(agent);
        const response = await this.runAgentConversation(
          agent, 
          prompt, 
          context, 
          allowedSkills,
          this.generateConversationId()
        );
        responses.push(response);

        // Store notifications for delivery
        if (response.notifications && response.notifications.length > 0) {
          await this.queueNotifications(response.notifications, context);
        }

        await this.markRun(runId, 'completed', {
          agentName: response.agentName,
          message: response.message,
          skillsUsed: response.skillsUsed,
          notificationCount: response.notifications?.length || 0,
        });

      } catch (error: any) {
        logger.error(`Agent ${agent.id} failed on event ${event}:`, error);
        await this.markRun(runId, 'failed', null, error?.message || String(error));
      }
    }

    // Sweep any pending workflow_run rows for this event that the loop above
    // never picked up (agent was filtered out by trigger conditions or by the
    // canWorkAutonomously guard).  Without this sweep those rows would sit
    // forever as 'pending' and pollute the Neural Network Hub's LIVE counter.
    //
    // Use a distinct terminal status `skipped` (rather than `failed`) so that
    // downstream analytics — failure-rate dashboards, alerting, etc. — do not
    // conflate operationally-skipped agents with genuine failures.  The
    // `agent_workflow_runs.status` column is `VARCHAR(16)` with no CHECK
    // constraint so any short label is accepted; the agents/status route's
    // `recent` query filters on `status IN ('completed','failed')` so skipped
    // rows are silently excluded from the recent-activity feed (which is the
    // desired UX — they are noise, not work that happened).
    if (eventId) {
      try {
        await query(
          `UPDATE agent_workflow_runs
              SET status       = 'skipped',
                  completed_at = NOW(),
                  error        = COALESCE(error, 'agent not eligible for this event')
            WHERE event_id = $1 AND status = 'pending'`,
          [eventId]
        );
      } catch (e: any) {
        logger.warn(`pending-run sweep failed: ${e?.message || e}`);
      }
    }

    return responses;
  }

  /**
   * Find the pending workflow_run row that the dispatcher pre-created for
   * (eventId, agentId).  Returns undefined if no eventId was threaded
   * through (e.g. dispatchEvent called directly from a test) or no row was
   * found.  Tracking is best-effort: failure here must not break dispatch.
   */
  private async findRunId(
    eventId: string | undefined,
    agentId: string
  ): Promise<string | undefined> {
    if (!eventId) return undefined;
    try {
      const r = await query(
        `SELECT id FROM agent_workflow_runs
          WHERE event_id = $1 AND agent_id = $2 AND status = 'pending'
          ORDER BY created_at DESC LIMIT 1`,
        [eventId, agentId]
      );
      return r.rows[0]?.id;
    } catch (e: any) {
      logger.warn(`findRunId failed: ${e?.message || e}`);
      return undefined;
    }
  }

  /**
   * Update the lifecycle of an agent_workflow_runs row.  No-op if runId is
   * undefined or the UPDATE itself errors — the Hub view degrades
   * gracefully and dispatch must not be blocked by bookkeeping.
   */
  private async markRun(
    runId: string | undefined,
    status: 'running' | 'completed' | 'failed',
    result?: any,
    errorMsg?: string
  ): Promise<void> {
    if (!runId) return;
    try {
      if (status === 'running') {
        await query(
          `UPDATE agent_workflow_runs
             SET status = 'running', started_at = NOW()
           WHERE id = $1`,
          [runId]
        );
      } else if (status === 'completed') {
        await query(
          `UPDATE agent_workflow_runs
             SET status = 'completed', completed_at = NOW(), result = $2
           WHERE id = $1`,
          [runId, result == null ? null : JSON.stringify(result)]
        );
      } else {
        await query(
          `UPDATE agent_workflow_runs
             SET status = 'failed', completed_at = NOW(), error = $2
           WHERE id = $1`,
          [runId, errorMsg || 'unknown error']
        );
      }
    } catch (e: any) {
      logger.warn(`markRun(${status}) failed: ${e?.message || e}`);
    }
  }

  /**
   * Route a message to the most appropriate agent
   */
  private async routeToAgent(message: string, context: AgentContext): Promise<AgentPersona> {
    const lowerMsg = message.toLowerCase();

    // Simple keyword routing (can be enhanced with LLM routing)
    const routingRules: [string[], string][] = [
      [['irr', 'return', 'equity multiple', 'cash on cash', 'sensitivity'], 'cfo'],
      [['tax', 'depreciation', '1031', 'cost seg'], 'accountant'],
      [['debt', 'loan', 'financing', 'refinance', 'refi', 'ltv', 'dscr'], 'lender'],
      [['contract', 'lease', 'legal', 'attorney', 'title'], 'legal'],
      [['compliance', 'insurance', 'permit', 'inspection'], 'compliance'],
      [['noi', 'expense', 'revenue', 'budget', 'variance', 'asset manage'], 'asset_manager'],
      [['occupancy', 'tenant', 'maintenance', 'work order'], 'property_manager'],
      [['rent', 'leasing', 'renewal', 'concession', 'lease up'], 'leasing'],
      [['capex', 'capital', 'hvac', 'roof', 'renovation'], 'facilities'],
      [['acquisition', 'buy', 'deal', 'loi', 'negotiate'], 'acquisitions'],
      [['development', 'construction', 'value add', 'rehab'], 'developer'],
      [['hold', 'sell', 'exit', 'disposition', 'portfolio'], 'investment_analyst'],
      [['marketing', 'positioning', 'campaign', 'branding'], 'marketing'],
      [['esg', 'sustainability', 'green', 'energy', 'environmental'], 'esg'],
      [['market', 'supply', 'demand', 'news', 'trend', 'research'], 'research'],
      [['strategy', 'jedi', 'score', 'recommend'], 'strategy'],
    ];

    for (const [keywords, agentId] of routingRules) {
      if (keywords.some(kw => lowerMsg.includes(kw))) {
        return getAgentById(agentId) || getAgentById('orchestrator')!;
      }
    }

    // Default to orchestrator
    return getAgentById('orchestrator')!;
  }

  /**
   * Run a conversation with a specific agent
   */
  private async runAgentConversation(
    agent: AgentPersona,
    message: string,
    context: AgentContext,
    allowedSkills: any[],
    conversationId: string
  ): Promise<AgentResponse> {
    
    const skillsUsed: string[] = [];
    const notifications: AgentNotification[] = [];

    // Load conversation history
    const history = await this.loadConversationHistory(conversationId, 10);

    // Build messages
    const messages: Anthropic.MessageParam[] = [
      ...history.map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    // Add deal context if available
    let systemPrompt = agent.systemPrompt;
    if (context.dealId) {
      const dealContext = await this.getDealContext(context.dealId);
      systemPrompt += `\n\nCurrent deal context:\n${JSON.stringify(dealContext, null, 2)}`;
    }

    // Initial API call
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools: allowedSkills,
      messages,
    });

    // Process tool calls
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        skillsUsed.push(toolUse.name);
        
        logger.info(`Agent ${agent.id} using skill: ${toolUse.name}`);

        const result = await skillRegistry.execute(
          toolUse.name,
          toolUse.input,
          {
            dealId: context.dealId || '',
            userId: context.userId,
            conversationId,
          }
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });

        // Check if skill result warrants a notification
        if (result.data?.alert || result.data?.requiresConfirmation) {
          notifications.push({
            type: result.data?.alert?.severity || 'info',
            title: result.data?.alert?.title || `${agent.name} Alert`,
            message: result.data?.alert?.message || result.data?.message || '',
            agentId: agent.id,
            dealId: context.dealId,
            channels: agent.notificationChannels,
          });
        }
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools: allowedSkills,
        messages,
      });
    }

    // Extract final text
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );
    const finalMessage = textBlocks.map(b => b.text).join('\n');

    // Save conversation
    await this.saveConversationMessage(conversationId, context.dealId, context.userId, 'user', message, agent.id);
    await this.saveConversationMessage(conversationId, context.dealId, context.userId, 'assistant', finalMessage, agent.id, skillsUsed);

    return {
      agentId: agent.id,
      agentName: agent.name,
      message: finalMessage,
      skillsUsed: [...new Set(skillsUsed)],
      notifications,
      conversationId,
    };
  }

  /**
   * Get tools available to a specific agent
   */
  private getAgentSkills(agent: AgentPersona): any[] {
    const allTools = skillRegistry.getToolDefinitions();
    
    if (agent.allowedSkills.includes('*')) {
      return allTools;
    }

    return allTools.filter(tool => 
      agent.allowedSkills.includes(tool.name)
    );
  }

  /**
   * Build a prompt for event-triggered agent work
   */
  private buildEventPrompt(agent: AgentPersona, trigger: any, data: Record<string, any>): string {
    const actionVerbs = {
      analyze: 'Analyze',
      alert: 'Check and alert if needed',
      report: 'Generate a report on',
      execute: 'Execute your standard workflow for',
    };

    const verb = actionVerbs[trigger.action as keyof typeof actionVerbs] || 'Process';

    return `${verb} the following ${trigger.event.replace(/_/g, ' ')} event:

Event: ${trigger.event}
Description: ${trigger.description}
Data: ${JSON.stringify(data, null, 2)}

Respond according to your role and expertise. If you find issues or important information, flag them clearly.`;
  }

  /**
   * Check if trigger conditions are met
   */
  private checkConditions(conditions: Record<string, any>, data: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      const dataVal = data[key];
      if (dataVal === undefined || dataVal === null) return false;

      // Normalize both sides for comparison
      const normalizedCondition = String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedData = String(dataVal).toLowerCase().replace(/[^a-z0-9]/g, '');

      // Support substring matching (e.g. 'offering' matches 'offeringmemorandum')
      if (!normalizedData.includes(normalizedCondition) && !normalizedCondition.includes(normalizedData)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get context about a deal
   */
  private async getDealContext(dealId: string): Promise<any> {
    try {
      const result = await query(
        `SELECT d.id, d.name, d.status, d.stage, 
                p.name as property_name, p.city, p.state, p.units
         FROM deals d
         LEFT JOIN properties p ON d.property_id = p.id
         WHERE d.id = $1`,
        [dealId]
      );
      return result.rows[0] || {};
    } catch {
      return {};
    }
  }

  /**
   * Queue notifications for delivery
   */
  private async queueNotifications(notifications: AgentNotification[], context: AgentContext): Promise<void> {
    for (const notif of notifications) {
      try {
        await query(
          `INSERT INTO agent_notifications 
           (user_id, deal_id, agent_id, type, title, message, channels, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            context.userId,
            notif.dealId,
            notif.agentId,
            notif.type,
            notif.title,
            notif.message,
            JSON.stringify(notif.channels),
          ]
        );
      } catch (error) {
        logger.warn('Failed to queue notification:', error);
      }
    }
  }

  /**
   * Load conversation history
   */
  private async loadConversationHistory(conversationId: string, limit: number): Promise<any[]> {
    try {
      const result = await query(
        `SELECT role, content FROM agent_conversations
         WHERE conversation_id = $1
         ORDER BY created_at ASC
         LIMIT $2`,
        [conversationId, limit]
      );
      return result.rows;
    } catch {
      return [];
    }
  }

  /**
   * Save conversation message
   */
  private async saveConversationMessage(
    conversationId: string,
    dealId: string | undefined,
    userId: string,
    role: 'user' | 'assistant',
    content: string,
    agentId: string,
    skillsUsed?: string[]
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO agent_conversations 
         (conversation_id, deal_id, user_id, agent_id, role, content, skills_used, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [conversationId, dealId, userId, agentId, role, content, skillsUsed ? JSON.stringify(skillsUsed) : null]
      );
    } catch (error) {
      logger.warn('Failed to save conversation:', error);
    }
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

// Export singleton
export const agentOrchestrator = new AgentOrchestrator();
export default agentOrchestrator;
