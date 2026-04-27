/**
 * Skill Chat Service
 * 
 * Handles conversations with Claude that can use skills (tools).
 * Claude picks which skills to call based on user messages.
 */

import Anthropic from '@anthropic-ai/sdk';
import { skillRegistry, SkillContext, SkillResult } from './skill-registry';
import { logger } from '../../utils/logger';
import { query } from '../../database/connection';

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  skillCalls?: SkillCallInfo[];
  timestamp?: Date;
}

export interface SkillCallInfo {
  skillId: string;
  skillName: string;
  parameters: Record<string, any>;
  result?: SkillResult;
  executionTimeMs?: number;
}

export interface ChatRequest {
  message: string;
  dealId: string;
  userId: string;
  conversationId?: string;
  /**
   * If set, force the orchestrator's first turn to call this exact skill.
   * Used for @mention persona routing (e.g. forcedSkillId='consult_cfo').
   * The skill must exist in the registry.
   */
  forcedSkillId?: string;
}

export interface ChatResponse {
  message: string;
  skillCalls: SkillCallInfo[];
  conversationId: string;
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are JEDI, an AI assistant for real estate investment analysis. You help analysts understand deals, run analyses, and make decisions.

You have access to skills (tools) that let you:
- Query deal data (financials, rent rolls, assumptions, comps)
- Search market data (MSA metrics, supply pipeline, employment)
- Extract data from uploaded documents
- Update underwriting assumptions (with user confirmation)
- Add notes to the deal timeline
- Run analyses (IRR sensitivity, refi scenarios)
- Generate reports (investment memos, NOI waterfalls)

Guidelines:
1. Before answering questions about a deal, use query_deal_data to fetch relevant context
2. For assumption changes, always ask for confirmation before executing
3. Be concise but thorough - analysts are busy
4. When showing numbers, format them clearly (currency, percentages)
5. If you're unsure about something, say so and suggest what data would help

You're currently viewing a specific deal. Use the skills to fetch its data rather than asking the user for information you can look up.`;

// ============================================================================
// CHAT SERVICE
// ============================================================================

export async function skillChat(request: ChatRequest): Promise<ChatResponse> {
  const { message, dealId, userId, conversationId, forcedSkillId } = request;
  const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const context: SkillContext = {
    dealId,
    userId,
    conversationId: convId,
  };

  const skillCalls: SkillCallInfo[] = [];

  try {
    // Load conversation history if exists
    const history = await loadConversationHistory(convId, 10);

    // Build messages array
    const messages: Anthropic.MessageParam[] = [
      ...history.map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    // Get tool definitions
    const tools = skillRegistry.getToolDefinitions();

    // If a forced skill is requested (e.g. @persona mention), force tool_choice
    // for the first turn only. Subsequent turns use auto.
    let initialToolChoice: Anthropic.MessageCreateParams['tool_choice'] | undefined;
    if (forcedSkillId) {
      const forced = skillRegistry.get(forcedSkillId);
      // Only advisor personas may be forced via @mention. This prevents clients
      // from forcing arbitrary action/data skills.
      const isAdvisor =
        !!forced &&
        forced.category === 'advisor' &&
        forcedSkillId.startsWith('consult_');
      if (!forced) {
        logger.warn(`Forced skill ${forcedSkillId} not found in registry; ignoring`);
      } else if (!isAdvisor) {
        logger.warn(`Forced skill ${forcedSkillId} is not an advisor persona; ignoring`);
      } else {
        initialToolChoice = { type: 'tool', name: forcedSkillId };
      }
    }

    // Initial API call
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
      ...(initialToolChoice ? { tool_choice: initialToolChoice } : {}),
    });

    // Process tool calls in a loop until Claude is done
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const startTime = Date.now();
        const skillInfo: SkillCallInfo = {
          skillId: toolUse.name,
          skillName: skillRegistry.get(toolUse.name)?.name || toolUse.name,
          parameters: toolUse.input as Record<string, any>,
        };

        logger.info(`Executing skill: ${toolUse.name}`, { params: toolUse.input, dealId });

        // Execute the skill
        const result = await skillRegistry.execute(
          toolUse.name,
          toolUse.input,
          context
        );

        skillInfo.result = result;
        skillInfo.executionTimeMs = Date.now() - startTime;
        skillCalls.push(skillInfo);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Continue conversation with tool results
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );
    const finalMessage = textBlocks.map(b => b.text).join('\n');

    // Save conversation
    await saveConversationMessage(convId, dealId, userId, 'user', message);
    await saveConversationMessage(convId, dealId, userId, 'assistant', finalMessage, skillCalls);

    return {
      message: finalMessage,
      skillCalls,
      conversationId: convId,
    };

  } catch (error: any) {
    logger.error('Skill chat error:', error);
    throw error;
  }
}

// ============================================================================
// CONVERSATION PERSISTENCE
// ============================================================================

async function loadConversationHistory(conversationId: string, limit: number): Promise<ChatMessage[]> {
  try {
    const result = await query(
      `SELECT role, content, skill_calls, created_at
       FROM skill_chat_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [conversationId, limit]
    );

    return result.rows.map(row => ({
      role: row.role,
      content: row.content,
      skillCalls: row.skill_calls,
      timestamp: row.created_at,
    }));
  } catch {
    // Table might not exist yet
    return [];
  }
}

async function saveConversationMessage(
  conversationId: string,
  dealId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  skillCalls?: SkillCallInfo[]
): Promise<void> {
  try {
    await query(
      `INSERT INTO skill_chat_messages (conversation_id, deal_id, user_id, role, content, skill_calls)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [conversationId, dealId, userId, role, content, skillCalls ? JSON.stringify(skillCalls) : null]
    );
  } catch (error) {
    // Log but don't fail - conversation persistence is nice-to-have
    logger.warn('Failed to save chat message:', error);
  }
}

// ============================================================================
// STREAMING SUPPORT (for future)
// ============================================================================

export async function* skillChatStream(request: ChatRequest): AsyncGenerator<{
  type: 'text' | 'skill_start' | 'skill_complete' | 'done';
  data: any;
}> {
  // For now, just wrap non-streaming response
  const response = await skillChat(request);
  
  for (const skillCall of response.skillCalls) {
    yield { type: 'skill_start', data: { skillId: skillCall.skillId, skillName: skillCall.skillName } };
    yield { type: 'skill_complete', data: skillCall };
  }
  
  yield { type: 'text', data: response.message };
  yield { type: 'done', data: { conversationId: response.conversationId } };
}
