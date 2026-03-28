/**
 * Agent Chat Service
 * 
 * Handles real-time chat with specialized JEDI agents.
 * Routes user queries to appropriate agents and formats responses.
 * 
 * @version 1.0.0
 * @date 2026-03-28
 */

import { generateCompletion, isLLMAvailable } from './llm.service';
import { logger } from '../utils/logger';
import { query } from '../database/connection';
import { orchestrate, chatWithAgent, SpecialistAgent } from './orchestrator.service';

// ============================================================================
// Types
// ============================================================================

export type AgentCode = 
  | 'ORCHESTRATOR' | 'SUPPLY' | 'DEMAND' | 'NEWS' | 'DEBT' 
  | 'STRATEGY' | 'CASH' | 'ZONING' | 'COMPS' | 'RISK';

export interface AgentChatRequest {
  agentCode: AgentCode;
  message: string;
  dealId?: string;
  msaId?: string;
  userId: string;
  sessionId?: string;
}

export interface AgentChatResponse {
  id: string;
  agentCode: AgentCode;
  message: string;
  data?: Record<string, unknown>;
  suggestedFollowups?: string[];
  timestamp: number;
}

interface AgentSystemPrompt {
  role: string;
  expertise: string[];
  tone: string;
  dataAccess: string[];
}

// ============================================================================
// Agent System Prompts
// ============================================================================

const AGENT_PROMPTS: Record<AgentCode, AgentSystemPrompt> = {
  ORCHESTRATOR: {
    role: 'Main AI coordinator for JEDI RE platform',
    expertise: ['portfolio overview', 'cross-agent coordination', 'general questions', 'deal prioritization'],
    tone: 'Professional, strategic, executive-level communication',
    dataAccess: ['all deals', 'all agents', 'portfolio metrics', 'user preferences'],
  },
  SUPPLY: {
    role: 'Supply and construction pipeline analyst',
    expertise: ['construction pipeline', 'permits', 'deliveries', 'competitive developments', 'supply pressure'],
    tone: 'Data-driven, precise, forward-looking',
    dataAccess: ['construction data', 'permit filings', 'pipeline tracker', 'competitive set'],
  },
  DEMAND: {
    role: 'Demand and absorption analyst',
    expertise: ['absorption rates', 'leasing velocity', 'employment trends', 'population growth', 'rent growth'],
    tone: 'Analytical, trend-focused, market-aware',
    dataAccess: ['absorption data', 'employment stats', 'demographic data', 'rent trends'],
  },
  NEWS: {
    role: 'Market news and sentiment analyst',
    expertise: ['market headlines', 'sentiment analysis', 'employer announcements', 'regulatory news', 'impact assessment'],
    tone: 'Timely, concise, impact-focused',
    dataAccess: ['news feeds', 'sentiment scores', 'headline impact', 'regulatory filings'],
  },
  DEBT: {
    role: 'Debt and financing specialist',
    expertise: ['interest rates', 'loan terms', 'lender activity', 'debt metrics', 'refinancing opportunities'],
    tone: 'Technical, precise, risk-aware',
    dataAccess: ['rate data', 'lender database', 'loan comparisons', 'debt service metrics'],
  },
  STRATEGY: {
    role: 'Investment strategy advisor',
    expertise: ['deal recommendations', 'timing analysis', 'risk-reward assessment', 'hold vs sell', 'JEDI score interpretation'],
    tone: 'Strategic, decisive, recommendation-focused',
    dataAccess: ['all agent insights', 'JEDI scores', 'scenario analysis', 'strategy models'],
  },
  CASH: {
    role: 'Cash flow and distributions analyst',
    expertise: ['cash flow projections', 'waterfall distributions', 'IRR calculations', 'variance analysis', 'capital calls'],
    tone: 'Quantitative, detail-oriented, investor-focused',
    dataAccess: ['proforma data', 'actual financials', 'distribution schedules', 'capital structure'],
  },
  ZONING: {
    role: 'Zoning and entitlements specialist',
    expertise: ['zoning codes', 'entitlement process', 'development capacity', 'variance requirements', 'regulatory compliance'],
    tone: 'Precise, regulatory-aware, process-oriented',
    dataAccess: ['zoning data', 'municipal codes', 'permit history', 'development standards'],
  },
  COMPS: {
    role: 'Comparable sales and rent analyst',
    expertise: ['sale comparables', 'rent comps', 'cap rate benchmarks', 'price per unit', 'market positioning'],
    tone: 'Market-focused, data-driven, benchmark-oriented',
    dataAccess: ['sales database', 'rent rolls', 'transaction history', 'market benchmarks'],
  },
  RISK: {
    role: 'Risk monitoring and alert specialist',
    expertise: ['risk identification', 'threshold monitoring', 'alert prioritization', 'risk mitigation', 'exposure analysis'],
    tone: 'Vigilant, proactive, alert-focused',
    dataAccess: ['risk metrics', 'alert thresholds', 'exposure data', 'historical incidents'],
  },
};

// ============================================================================
// Context Builders
// ============================================================================

async function getDealContext(dealId: string): Promise<Record<string, unknown> | null> {
  try {
    const result = await query(
      `SELECT 
        d.id, d.name, d.address_line1, d.city, d.state_code,
        d.property_type, d.units, d.asking_price, d.pipeline_stage,
        d.acquisition_date, d.recommended_strategy,
        j.total_score as jedi_score, j.market_score, j.financial_score,
        j.location_score, j.risk_score
      FROM deals d
      LEFT JOIN jedi_scores j ON j.deal_id = d.id
      WHERE d.id = $1`,
      [dealId]
    );
    
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get deal context:', error);
    return null;
  }
}

async function getMarketContext(msaId: string): Promise<Record<string, unknown> | null> {
  try {
    const result = await query(
      `SELECT 
        msa_code, msa_name, population, employment_rate,
        median_income, vacancy_rate, avg_rent, rent_growth_yoy,
        cap_rate, absorption_rate
      FROM msa_metrics
      WHERE msa_code = $1
      ORDER BY as_of_date DESC
      LIMIT 1`,
      [msaId]
    );
    
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get market context:', error);
    return null;
  }
}

async function getRecentAlerts(dealId?: string, limit = 5): Promise<unknown[]> {
  try {
    let sql = `
      SELECT id, alert_type, severity, title, message, created_at
      FROM jedi_alerts
      WHERE dismissed_at IS NULL
    `;
    const params: unknown[] = [];
    
    if (dealId) {
      sql += ` AND deal_id = $1`;
      params.push(dealId);
    }
    
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get recent alerts:', error);
    return [];
  }
}

// ============================================================================
// Main Chat Function
// ============================================================================

export async function agentChat(request: AgentChatRequest): Promise<AgentChatResponse> {
  const { agentCode, message, dealId, msaId, userId } = request;
  const startTime = Date.now();

  logger.info('Agent chat request:', { agentCode, dealId, userId, messageLength: message.length });

  // =========================================================================
  // ORCHESTRATOR: Route through orchestrator service for intelligent delegation
  // =========================================================================
  if (agentCode === 'ORCHESTRATOR') {
    try {
      const orchestratorResult = await orchestrate({
        message,
        dealId,
        msaId,
        userId,
      });

      const executionTime = Date.now() - startTime;
      await logChatInteraction(request, orchestratorResult.message, executionTime);

      return {
        id: crypto.randomUUID(),
        agentCode: 'ORCHESTRATOR',
        message: orchestratorResult.message,
        data: {
          delegations: orchestratorResult.delegations,
        },
        suggestedFollowups: orchestratorResult.suggestedFollowups,
        timestamp: orchestratorResult.timestamp,
      };
    } catch (error: any) {
      logger.error('Orchestrator failed:', error);
      return generateFallbackResponse(agentCode, message);
    }
  }

  // =========================================================================
  // SPECIALIST AGENTS: Try executor first, then fall back to LLM
  // =========================================================================
  const specialistAgents: AgentCode[] = ['SUPPLY', 'DEMAND', 'CASH', 'ZONING', 'COMPS', 'RISK', 'DEBT'];
  
  if (specialistAgents.includes(agentCode)) {
    try {
      // Try to get real data from agent executor
      const agentResult = await chatWithAgent(
        agentCode as SpecialistAgent,
        message,
        { dealId, msaId },
        userId
      );

      if (agentResult.success) {
        // Format the data with LLM if available
        let responseMessage: string;
        
        if (isLLMAvailable()) {
          const agentConfig = AGENT_PROMPTS[agentCode];
          const formattingPrompt = `You are the ${agentConfig?.role || agentCode + ' agent'}. 
Format this data as a helpful response to the user's question: "${message}"

Data:
${JSON.stringify(agentResult.data, null, 2)}

Be concise, highlight key insights, and use natural language.`;

          const llmResponse = await generateCompletion({
            prompt: formattingPrompt,
            maxTokens: 800,
            temperature: 0.7,
          });
          responseMessage = llmResponse.text;
        } else {
          responseMessage = `Here's the ${agentCode.toLowerCase()} analysis:\n\n${JSON.stringify(agentResult.data, null, 2)}`;
        }

        const executionTime = Date.now() - startTime;
        await logChatInteraction(request, responseMessage, executionTime);

        return {
          id: crypto.randomUUID(),
          agentCode,
          message: responseMessage,
          data: agentResult.data,
          suggestedFollowups: generateFollowups(agentCode, message),
          timestamp: Date.now(),
        };
      }
      // If agent executor failed, fall through to LLM-only response
    } catch (error) {
      logger.warn(`${agentCode} executor failed, falling back to LLM:`, error);
      // Fall through to LLM-only response
    }
  }

  // =========================================================================
  // LLM-ONLY AGENTS (Analysts, Strategy, etc.)
  // =========================================================================
  
  // Check LLM availability
  if (!isLLMAvailable()) {
    return generateFallbackResponse(agentCode, message);
  }

  try {
    // Get agent prompt config
    const agentConfig = AGENT_PROMPTS[agentCode];
    if (!agentConfig) {
      throw new Error(`Unknown agent: ${agentCode}`);
    }

    // Build context
    const dealContext = dealId ? await getDealContext(dealId) : null;
    const marketContext = msaId ? await getMarketContext(msaId) : null;
    const alerts = await getRecentAlerts(dealId);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(agentCode, agentConfig, dealContext, marketContext, alerts);

    // Call LLM
    const llmResponse = await generateCompletion({
      prompt: `${systemPrompt}\n\nUser Query: ${message}\n\nRespond as the ${agentConfig.role}. Be concise but thorough. If you reference specific data, cite the source.`,
      maxTokens: 1024,
      temperature: 0.7,
    });

    const executionTime = Date.now() - startTime;
    logger.info('Agent chat completed:', { agentCode, executionTime });

    // Log the interaction
    await logChatInteraction(request, llmResponse.text, executionTime);

    return {
      id: crypto.randomUUID(),
      agentCode,
      message: llmResponse.text,
      data: {
        dealContext: dealContext ? { name: dealContext.name, jediScore: dealContext.jedi_score } : undefined,
        marketContext: marketContext ? { msaName: marketContext.msa_name } : undefined,
      },
      suggestedFollowups: generateFollowups(agentCode, message),
      timestamp: Date.now(),
    };

  } catch (error: any) {
    logger.error('Agent chat failed:', { agentCode, error: error.message });
    return generateFallbackResponse(agentCode, message);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildSystemPrompt(
  agentCode: AgentCode,
  config: AgentSystemPrompt,
  dealContext: Record<string, unknown> | null,
  marketContext: Record<string, unknown> | null,
  alerts: unknown[]
): string {
  let prompt = `You are the ${config.role} for JEDI RE, a real estate investment intelligence platform.

Your expertise: ${config.expertise.join(', ')}
Your communication style: ${config.tone}
Data you have access to: ${config.dataAccess.join(', ')}

`;

  if (dealContext) {
    prompt += `
CURRENT DEAL CONTEXT:
- Name: ${dealContext.name}
- Address: ${dealContext.address_line1}, ${dealContext.city}, ${dealContext.state_code}
- Property Type: ${dealContext.property_type}
- Units: ${dealContext.units}
- Asking Price: $${Number(dealContext.asking_price).toLocaleString()}
- Pipeline Stage: ${dealContext.pipeline_stage}
- JEDI Score: ${dealContext.jedi_score || 'Not calculated'}
- Recommended Strategy: ${dealContext.recommended_strategy || 'Pending analysis'}

`;
  }

  if (marketContext) {
    prompt += `
MARKET CONTEXT (${marketContext.msa_name}):
- Population: ${Number(marketContext.population).toLocaleString()}
- Vacancy Rate: ${marketContext.vacancy_rate}%
- Average Rent: $${Number(marketContext.avg_rent).toLocaleString()}
- Rent Growth YoY: ${marketContext.rent_growth_yoy}%
- Cap Rate: ${marketContext.cap_rate}%
- Absorption Rate: ${marketContext.absorption_rate}%

`;
  }

  if (alerts.length > 0) {
    prompt += `
RECENT ALERTS:
${alerts.map((a: any) => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.message}`).join('\n')}

`;
  }

  prompt += `
RESPONSE GUIDELINES:
1. Be specific and data-driven
2. Reference the context data when relevant
3. Provide actionable insights
4. If you don't have enough information, say so and suggest what data would help
5. Keep responses concise (under 200 words unless complex analysis required)
`;

  return prompt;
}

function generateFollowups(agentCode: AgentCode, originalMessage: string): string[] {
  const followups: Record<AgentCode, string[]> = {
    ORCHESTRATOR: ['What deals need attention?', 'Portfolio summary', 'Today\'s priorities'],
    SUPPLY: ['Pipeline details', 'Competitive threats', 'Delivery timeline'],
    DEMAND: ['Absorption forecast', 'Employment drivers', 'Rent trajectory'],
    NEWS: ['Recent headlines', 'Sentiment trend', 'Impact on my deals'],
    DEBT: ['Current rates', 'Refi options', 'Lender recommendations'],
    STRATEGY: ['Exit scenarios', 'Hold vs sell', 'Sensitivity analysis'],
    CASH: ['Cash flow projection', 'Distribution schedule', 'IRR at exit'],
    ZONING: ['Development capacity', 'Entitlement timeline', 'Variance required?'],
    COMPS: ['Recent sales', 'Rent comps', 'Cap rate trends'],
    RISK: ['Top risks', 'Threshold alerts', 'Mitigation options'],
  };

  return followups[agentCode] || [];
}

function generateFallbackResponse(agentCode: AgentCode, message: string): AgentChatResponse {
  const config = AGENT_PROMPTS[agentCode];
  
  return {
    id: crypto.randomUUID(),
    agentCode,
    message: `I'm the ${config?.role || agentCode + ' Agent'}. I understand you're asking about: "${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"

I'm currently operating in limited mode. To get full AI-powered responses, please ensure the LLM service is configured.

In the meantime, I can help you navigate to the relevant data in the platform. What specific information are you looking for?`,
    suggestedFollowups: generateFollowups(agentCode, message),
    timestamp: Date.now(),
  };
}

async function logChatInteraction(
  request: AgentChatRequest,
  response: string,
  executionTimeMs: number
): Promise<void> {
  try {
    await query(
      `INSERT INTO agent_chat_logs (
        agent_code, user_id, deal_id, msa_id, user_message, 
        agent_response, execution_time_ms, session_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        request.agentCode,
        request.userId,
        request.dealId,
        request.msaId,
        request.message,
        response,
        executionTimeMs,
        request.sessionId,
      ]
    );
  } catch (error) {
    // Don't fail the request if logging fails
    logger.warn('Failed to log chat interaction:', error);
  }
}

// ============================================================================
// Notification Functions (for Orchestrator to send to mobile)
// ============================================================================

export interface MobileNotification {
  userId: string;
  title: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  dealId?: string;
  agentSource: AgentCode;
  actionUrl?: string;
}

export async function sendMobileNotification(notification: MobileNotification): Promise<boolean> {
  try {
    // Store notification
    await query(
      `INSERT INTO user_notifications (
        user_id, title, body, priority, deal_id, 
        agent_source, action_url, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        notification.userId,
        notification.title,
        notification.body,
        notification.priority,
        notification.dealId,
        notification.agentSource,
        notification.actionUrl,
      ]
    );

    // TODO: Integrate with push notification service (Firebase, OneSignal, etc.)
    // For now, just log and store
    logger.info('Mobile notification queued:', {
      userId: notification.userId,
      title: notification.title,
      priority: notification.priority,
    });

    return true;
  } catch (error) {
    logger.error('Failed to send mobile notification:', error);
    return false;
  }
}

export async function getUserNotifications(
  userId: string,
  limit = 20,
  unreadOnly = false
): Promise<unknown[]> {
  try {
    let sql = `
      SELECT id, title, body, priority, deal_id, agent_source, 
             action_url, created_at, read_at
      FROM user_notifications
      WHERE user_id = $1
    `;
    
    if (unreadOnly) {
      sql += ` AND read_at IS NULL`;
    }
    
    sql += ` ORDER BY created_at DESC LIMIT $2`;
    
    const result = await query(sql, [userId, limit]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get user notifications:', error);
    return [];
  }
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<boolean> {
  try {
    const result = await query(
      `UPDATE user_notifications 
       SET read_at = NOW() 
       WHERE id = $1 AND user_id = $2 AND read_at IS NULL
       RETURNING id`,
      [notificationId, userId]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Failed to mark notification read:', error);
    return false;
  }
}
