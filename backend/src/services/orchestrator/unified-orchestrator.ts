/**
 * Unified Orchestrator
 * 
 * Single brain for ALL channels (Web, Twilio, Telegram, Mobile).
 * Replaces both AICoordinator and the original orchestrator.service.
 * 
 * Flow:
 * 1. Receive message from any channel
 * 2. Classify intent
 * 3. Delegate to specialist + analyst agents
 * 4. Synthesize response with JEDI score
 * 5. Return formatted for channel
 * 
 * @version 2.0.0
 * @date 2026-03-28
 */

import { logger } from '../../utils/logger';
import { query } from '../../database/connection';
import { IntentClassifier, ExtractedIntent } from './intent-classifier';
import { AgentDelegator, DelegationResult } from './agent-delegator';
import { ResponseSynthesizer, SynthesizedResponse } from './response-synthesizer';

// ============================================================================
// Types
// ============================================================================

export type ChatPlatform = 'web' | 'telegram' | 'whatsapp' | 'imessage' | 'sms' | 'mobile';

export interface OrchestratorRequest {
  // Message content
  message: string;
  attachments?: Array<{ type: string; url: string }>;
  
  // User context
  userId: string;
  platform: ChatPlatform;
  platformUserId?: string;
  
  // Deal/market context
  dealId?: string;
  msaId?: string;
  
  // Session context
  sessionId?: string;
  conversationHistory?: Array<{ role: string; content: string; timestamp?: string }>;
  
  // User preferences
  userTier?: 'free' | 'pro' | 'enterprise';
}

export interface OrchestratorResponse {
  // Core response
  text: string;
  summary?: string;
  
  // JEDI scoring
  jediScore?: number;
  jediBreakdown?: {
    zoning: number;
    market: number;
    financial: number;
  };
  recommendation?: 'BUY' | 'HOLD' | 'SELL' | 'INVESTIGATE' | 'PASS';
  
  // Supporting data
  data?: Record<string, unknown>;
  agentContributions: Array<{
    agent: string;
    summary: string;
    success: boolean;
  }>;
  
  // Follow-up options
  suggestedFollowups: string[];
  inlineKeyboard?: {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  };
  
  // Credits (for billing)
  creditsUsed?: number;
  creditsRemaining?: number;
  
  // Metadata
  executionTimeMs: number;
  timestamp: number;
  platform: ChatPlatform;
  sessionId?: string;
}

// ============================================================================
// Greeting Responses
// ============================================================================

const GREETINGS = [
  "Hey! I'm JEDI, your real estate investment AI. Drop an address or ask me anything about a deal.",
  "Hi there! Ready to analyze some deals. What property are you looking at?",
  "Hello! I can help you analyze properties, run cash flow projections, check zoning, and more. What's on your mind?",
];

// ============================================================================
// Unified Orchestrator
// ============================================================================

export class UnifiedOrchestrator {
  private intentClassifier: IntentClassifier;
  private agentDelegator: AgentDelegator;
  private responseSynthesizer: ResponseSynthesizer;
  
  constructor() {
    this.intentClassifier = new IntentClassifier();
    this.agentDelegator = new AgentDelegator();
    this.responseSynthesizer = new ResponseSynthesizer();
  }
  
  /**
   * Main entry point — process any message from any channel
   */
  async process(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const startTime = Date.now();
    
    logger.info('Orchestrator processing', {
      platform: request.platform,
      userId: request.userId,
      messageLength: request.message.length,
      hasDealContext: !!request.dealId,
    });
    
    try {
      // 1. Classify intent
      const intent = await this.intentClassifier.classify(request.message, {
        dealId: request.dealId,
        msaId: request.msaId,
        conversationHistory: request.conversationHistory,
      });
      
      logger.info('Intent classified', {
        type: intent.type,
        confidence: intent.confidence,
        specialists: intent.specialists,
        analysts: intent.analysts,
      });
      
      // 2. Handle special intents
      if (intent.type === 'greeting') {
        return this.handleGreeting(request, startTime);
      }
      
      // 3. Get user model preferences
      const modelOverrides = await this.agentDelegator.getUserModelPreferences(request.userId);
      
      // 4. Delegate to agents
      const delegationResults = await this.agentDelegator.delegate({
        intent,
        userId: request.userId,
        userTier: request.userTier,
        modelOverrides,
      });
      
      // 5. Synthesize response
      const synthesized = await this.responseSynthesizer.synthesize(intent, delegationResults, {
        platform: request.platform,
        includeScore: intent.type === 'full_analysis',
      });
      
      // 6. Log interaction
      await this.logInteraction(request, intent, delegationResults, synthesized);
      
      // 7. Build final response
      return {
        ...synthesized,
        platform: request.platform,
        sessionId: request.sessionId,
        executionTimeMs: Date.now() - startTime,
      };
      
    } catch (error: any) {
      logger.error('Orchestrator error:', error);
      return this.handleError(request, error, startTime);
    }
  }
  
  /**
   * Handle greeting messages
   */
  private handleGreeting(request: OrchestratorRequest, startTime: number): OrchestratorResponse {
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    
    return {
      text: greeting,
      agentContributions: [],
      suggestedFollowups: [
        'Analyze a property',
        'Market research',
        'Portfolio overview',
        'Help me find deals',
      ],
      inlineKeyboard: {
        inline_keyboard: [
          [
            { text: '📍 Analyze Property', callback_data: 'Analyze a property' },
            { text: '📊 Market Research', callback_data: 'Market research' },
          ],
          [
            { text: '📁 My Portfolio', callback_data: 'Portfolio overview' },
            { text: '🔍 Find Deals', callback_data: 'Help me find deals' },
          ],
        ],
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: Date.now(),
      platform: request.platform,
      sessionId: request.sessionId,
    };
  }
  
  /**
   * Handle errors gracefully
   */
  private handleError(
    request: OrchestratorRequest,
    error: Error,
    startTime: number
  ): OrchestratorResponse {
    return {
      text: `I ran into an issue: ${error.message}. Please try again or rephrase your question.`,
      agentContributions: [],
      suggestedFollowups: ['Try again', 'Ask something else'],
      executionTimeMs: Date.now() - startTime,
      timestamp: Date.now(),
      platform: request.platform,
      sessionId: request.sessionId,
    };
  }
  
  /**
   * Log interaction for analytics
   */
  private async logInteraction(
    request: OrchestratorRequest,
    intent: ExtractedIntent,
    delegations: DelegationResult[],
    response: SynthesizedResponse
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO orchestrator_logs (
          user_id, platform, session_id, message, intent_type, intent_confidence,
          specialists_called, analysts_called, jedi_score, execution_time_ms, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [
          request.userId,
          request.platform,
          request.sessionId,
          request.message.slice(0, 500),
          intent.type,
          intent.confidence,
          intent.specialists,
          intent.analysts,
          response.jediScore,
          response.executionTimeMs,
        ]
      );
    } catch (error) {
      // Don't fail the request if logging fails
      logger.warn('Failed to log orchestrator interaction:', error);
    }
  }
  
  /**
   * Direct agent chat (bypass orchestrator routing)
   */
  async chatWithAgent(
    agentCode: string,
    message: string,
    context: {
      userId: string;
      dealId?: string;
      msaId?: string;
      platform?: ChatPlatform;
    }
  ): Promise<OrchestratorResponse> {
    const startTime = Date.now();
    
    // Create intent targeting specific agent
    const intent: ExtractedIntent = {
      type: 'agent_query',
      confidence: 1.0,
      question: message,
      dealId: context.dealId,
      msaId: context.msaId,
      specialists: this.isSpecialist(agentCode) ? [agentCode as any] : [],
      analysts: this.isAnalyst(agentCode) ? [agentCode as any] : [],
    };
    
    const modelOverrides = await this.agentDelegator.getUserModelPreferences(context.userId);
    
    const delegationResults = await this.agentDelegator.delegate({
      intent,
      userId: context.userId,
      modelOverrides,
    });
    
    const synthesized = await this.responseSynthesizer.synthesize(intent, delegationResults);
    
    return {
      ...synthesized,
      platform: context.platform || 'web',
      executionTimeMs: Date.now() - startTime,
    };
  }
  
  private isSpecialist(code: string): boolean {
    return ['SUPPLY', 'DEMAND', 'CASH', 'ZONING', 'COMPS', 'RISK', 'DEBT', 'RESEARCH', 'NEWS', 'STRATEGY'].includes(code);
  }
  
  private isAnalyst(code: string): boolean {
    return code.startsWith('AN') || ['CFO', 'ACCOUNTANT', 'MARKETING', 'DEVELOPER', 'LEGAL', 'LENDER', 'ACQUISITIONS', 'ASSET_MANAGER', 'PROPERTY_MANAGER', 'LEASING', 'FACILITIES', 'INVESTMENT_ANALYST', 'ESG', 'COMPLIANCE', 'TAX', 'RESEARCHER'].includes(code);
  }
}

// Export singleton
export const unifiedOrchestrator = new UnifiedOrchestrator();
