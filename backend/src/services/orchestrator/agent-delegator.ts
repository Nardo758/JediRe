/**
 * Agent Delegator
 * 
 * Routes requests to specialist and analyst agents.
 * Executes agents in parallel when independent.
 * 
 * @version 1.0.0
 * @date 2026-03-28
 */

import { logger } from '../../utils/logger';
import { query } from '../../database/connection';
import { generateCompletion, isLLMAvailable } from '../llm.service';
import type { SpecialistAgent, AnalystAgent, ExtractedIntent } from './intent-classifier';
import { getDealFinancialContext, formatFinancialContextForPrompt, DealFinancialContext } from '../deal-financial-context.service';

// Import agent executors
import { SupplyAgent } from '../../agents/supply.agent';
import { CashFlowAgent } from '../../agents/cashflow.agent';
import { ZoningAgent } from '../../agents/zoning.agent';
import { ResearchAgent } from '../../agents/research.agent';
import { CommentaryAgent } from '../../agents/commentary.agent';
import { MetricRecommendationService } from '../metricRecommendation.service';

// ============================================================================
// Types
// ============================================================================

export interface DelegationResult {
  agent: string;
  agentType: 'specialist' | 'analyst';
  data: Record<string, unknown>;
  summary?: string;
  executionTimeMs: number;
  success: boolean;
  error?: string;
}

export interface DelegationRequest {
  intent: ExtractedIntent;
  userId: string;
  userTier?: string;
  modelOverrides?: Record<string, string>;
}

// ============================================================================
// Agent Executor Registry
// ============================================================================

const SPECIALIST_EXECUTORS: Partial<Record<SpecialistAgent, any>> = {
  SUPPLY: new SupplyAgent(),
  CASH: new CashFlowAgent(),
  ZONING: new ZoningAgent(),
  RESEARCH: new ResearchAgent(),
  // DEMAND, COMPS, RISK, DEBT, NEWS — stubs until implemented
};

// Analyst agent system prompts
const ANALYST_PROMPTS: Record<AnalystAgent, { role: string; focus: string }> = {
  CFO: { role: 'Chief Financial Officer', focus: 'returns, risk metrics, investment performance' },
  ACCOUNTANT: { role: 'Accountant', focus: 'tax implications, GAAP compliance, depreciation' },
  MARKETING: { role: 'Marketing Expert', focus: 'positioning, lease-up strategy, branding' },
  DEVELOPER: { role: 'Developer', focus: 'construction feasibility, value-add, renovations' },
  LEGAL: { role: 'Legal Advisor', focus: 'contracts, compliance, legal risk' },
  LENDER: { role: 'Lender', focus: 'debt perspective, underwriting, financing' },
  ACQUISITIONS: { role: 'Acquisitions Director', focus: 'deal sourcing, negotiations, LOI terms' },
  ASSET_MANAGER: { role: 'Asset Manager', focus: 'NOI optimization, operations, business plan' },
  PROPERTY_MANAGER: { role: 'Property Manager', focus: 'tenant relations, maintenance, operations' },
  LEASING: { role: 'Leasing Director', focus: 'vacancy reduction, renewals, rent pricing' },
  FACILITIES: { role: 'Facilities Manager', focus: 'CapEx planning, vendors, building systems' },
  INVESTMENT_ANALYST: { role: 'Investment Analyst', focus: 'hold/sell analysis, refinance, exit strategy' },
  ESG: { role: 'ESG Specialist', focus: 'sustainability, energy efficiency, green certifications' },
  COMPLIANCE: { role: 'Compliance Officer', focus: 'insurance, permits, regulatory requirements' },
  TAX: { role: 'Tax Strategist', focus: 'cost segregation, 1031 exchanges, depreciation' },
  RESEARCHER: { role: 'Market Researcher', focus: 'demographics, trends, competitive intelligence' },
};

// ============================================================================
// Agent Delegator
// ============================================================================

export class AgentDelegator {
  
  /**
   * Delegate to all required agents based on intent
   */
  private static METRIC_REC_TRIGGERS = [
    'what metrics', 'which metrics', 'metrics to watch', 'recommended metrics',
    'metric recommendations', 'what should i watch', 'what should i track',
    'leading indicators', 'suggest metrics', 'suggested metrics',
  ];

  private isMetricRecommendationQuery(message: string): boolean {
    const lower = message.toLowerCase();
    return AgentDelegator.METRIC_REC_TRIGGERS.some(t => lower.includes(t));
  }

  async delegate(request: DelegationRequest): Promise<DelegationResult[]> {
    const { intent, userId, modelOverrides } = request;
    const results: DelegationResult[] = [];
    
    const params = this.buildParams(intent);

    let financialContext: DealFinancialContext | null = null;
    if (intent.dealId) {
      try {
        financialContext = await getDealFinancialContext(intent.dealId);
        params.financialContext = financialContext;
      } catch (err) {
        logger.warn('Failed to fetch financial context for delegation:', err);
      }
    }

    if (this.isMetricRecommendationQuery(intent.question || '')) {
      const recResult = await this.executeMetricRecommendations(params, userId);
      results.push(recResult);
    }
    
    if (intent.specialists.length > 0) {
      const specialistPromises = intent.specialists.map(agent =>
        this.executeSpecialist(agent, params, userId)
      );
      const specialistResults = await Promise.all(specialistPromises);
      results.push(...specialistResults);
    }
    
    if (intent.analysts.length > 0) {
      const specialistData = results
        .filter(r => r.success && r.agentType === 'specialist')
        .reduce((acc, r) => ({ ...acc, [r.agent]: r.data }), {});
      
      if (financialContext && financialContext.hasFinancialData) {
        specialistData['FINANCIAL_DATA'] = financialContext;
      }

      const analystPromises = intent.analysts.map(agent =>
        this.executeAnalyst(agent, params, specialistData, userId, modelOverrides?.[agent])
      );
      const analystResults = await Promise.all(analystPromises);
      results.push(...analystResults);
    }
    
    return results;
  }
  
  /**
   * Execute a specialist agent (data-focused)
   */
  private async executeSpecialist(
    agent: SpecialistAgent,
    params: Record<string, unknown>,
    userId: string
  ): Promise<DelegationResult> {
    const startTime = Date.now();
    
    const executor = SPECIALIST_EXECUTORS[agent];
    if (!executor) {
      // Return stub for unimplemented agents
      return {
        agent,
        agentType: 'specialist',
        data: { message: `${agent} agent coming soon` },
        executionTimeMs: Date.now() - startTime,
        success: false,
        error: 'Agent not yet implemented',
      };
    }
    
    try {
      logger.info(`Executing specialist: ${agent}`, { params });
      const result = await executor.execute(params, userId);
      
      return {
        agent,
        agentType: 'specialist',
        data: result,
        executionTimeMs: Date.now() - startTime,
        success: true,
      };
    } catch (error: any) {
      logger.error(`Specialist ${agent} failed:`, error);
      return {
        agent,
        agentType: 'specialist',
        data: {},
        executionTimeMs: Date.now() - startTime,
        success: false,
        error: error.message,
      };
    }
  }
  
  private async executeMetricRecommendations(
    params: Record<string, unknown>,
    userId: string
  ): Promise<DelegationResult> {
    const startTime = Date.now();
    try {
      const agent = new MetricRecommendationService();
      let marketGeoIds: Array<{ geoType: string; geoId: string }> = [];

      const city = (params.city as string) || '';
      const stateCode = ((params.stateCode as string) || '').toLowerCase();
      if (city && stateCode) {
        const slug = city.toLowerCase().replace(/\s+/g, '-');
        marketGeoIds.push({ geoType: 'metro', geoId: `${slug}-${stateCode}-${stateCode}` });
      }

      if (marketGeoIds.length === 0) {
        try {
          const { getPool } = await import('../../database/connection');
          const pool = getPool();
          const prefRes = await pool.query(
            `SELECT am.slug, am.state
             FROM user_market_preferences ump
             JOIN available_markets am ON am.id = ump.market_id
             WHERE ump.user_id = $1 AND ump.is_tracked = true`,
            [userId]
          );
          if (prefRes.rows.length > 0) {
            marketGeoIds = prefRes.rows.map((r: { slug: string; state: string }) => ({
              geoType: 'metro',
              geoId: `${r.slug}-${(r.state || '').toLowerCase()}-${(r.state || '').toLowerCase()}`
            }));
          }
        } catch (dbErr) {
          logger.warn('Could not fetch tracked markets for recommendations:', dbErr);
        }
      }

      if (marketGeoIds.length === 0) {
        return {
          agent: 'METRIC_RECOMMENDATIONS',
          agentType: 'specialist',
          data: { message: 'Please specify a market or track markets in your dashboard to get metric recommendations.' },
          executionTimeMs: Date.now() - startTime,
          success: false,
          error: 'No tracked markets found. Star markets in F4 Dashboard or specify a city.',
        };
      }

      const result = await agent.execute({ marketGeoIds, topN: 5 }, userId);
      return {
        agent: 'METRIC_RECOMMENDATIONS',
        agentType: 'specialist',
        data: result as unknown as Record<string, unknown>,
        summary: result.summary,
        executionTimeMs: Date.now() - startTime,
        success: result.success,
      };
    } catch (error: any) {
      logger.error('MetricRecommendation delegation failed:', error);
      return {
        agent: 'METRIC_RECOMMENDATIONS',
        agentType: 'specialist',
        data: {},
        executionTimeMs: Date.now() - startTime,
        success: false,
        error: error.message,
      };
    }
  }

  private async executeAnalyst(
    agent: AnalystAgent,
    params: Record<string, unknown>,
    contextData: Record<string, unknown>,
    userId: string,
    modelOverride?: string
  ): Promise<DelegationResult> {
    const startTime = Date.now();
    
    if (!isLLMAvailable()) {
      return {
        agent,
        agentType: 'analyst',
        data: { message: 'LLM not available' },
        executionTimeMs: Date.now() - startTime,
        success: false,
        error: 'LLM service unavailable',
      };
    }
    
    const analystConfig = ANALYST_PROMPTS[agent];
    if (!analystConfig) {
      return {
        agent,
        agentType: 'analyst',
        data: {},
        executionTimeMs: Date.now() - startTime,
        success: false,
        error: 'Unknown analyst agent',
      };
    }
    
    try {
      const prompt = this.buildAnalystPrompt(agent, analystConfig, params, contextData);
      
      const response = await generateCompletion({
        prompt,
        maxTokens: 800,
        temperature: 0.7,
        model: modelOverride,
      });
      
      return {
        agent,
        agentType: 'analyst',
        data: { analysis: response.text },
        summary: response.text,
        executionTimeMs: Date.now() - startTime,
        success: true,
      };
    } catch (error: any) {
      logger.error(`Analyst ${agent} failed:`, error);
      return {
        agent,
        agentType: 'analyst',
        data: {},
        executionTimeMs: Date.now() - startTime,
        success: false,
        error: error.message,
      };
    }
  }
  
  /**
   * Build params from intent
   */
  private buildParams(intent: ExtractedIntent): Record<string, unknown> {
    return {
      address: intent.address,
      city: intent.city,
      stateCode: intent.stateCode,
      price: intent.price,
      dealId: intent.dealId,
      msaId: intent.msaId,
      question: intent.question,
    };
  }
  
  /**
   * Build prompt for analyst agent
   */
  private buildAnalystPrompt(
    agent: AnalystAgent,
    config: { role: string; focus: string },
    params: Record<string, unknown>,
    contextData: Record<string, unknown>
  ): string {
    let prompt = `You are the ${config.role} for JEDI RE, a real estate investment platform.
Your expertise: ${config.focus}

`;

    if (params.address) {
      prompt += `Property: ${params.address}\n`;
    }
    if (params.city && params.stateCode) {
      prompt += `Market: ${params.city}, ${params.stateCode}\n`;
    }
    if (params.price) {
      prompt += `Price: $${Number(params.price).toLocaleString()}\n`;
    }
    
    if (contextData['FINANCIAL_DATA']) {
      const finCtx = contextData['FINANCIAL_DATA'] as DealFinancialContext;
      prompt += formatFinancialContextForPrompt(finCtx);
      prompt += '\n';
    }

    const nonFinancialData = Object.entries(contextData).filter(([k]) => k !== 'FINANCIAL_DATA');
    if (nonFinancialData.length > 0) {
      prompt += `\nAvailable Data:\n`;
      for (const [source, data] of nonFinancialData) {
        prompt += `\n[${source}]:\n${JSON.stringify(data, null, 2)}\n`;
      }
    }
    
    prompt += `\nUser Question: ${params.question || 'Provide your analysis'}

Respond as the ${config.role}. Be specific, actionable, and concise (under 200 words).
Reference the data when relevant. Flag any concerns or opportunities.`;

    return prompt;
  }
  
  /**
   * Get user's model preferences for agents
   */
  async getUserModelPreferences(userId: string): Promise<Record<string, string>> {
    try {
      const result = await query(
        `SELECT settings_json FROM user_agent_settings 
         WHERE user_id = $1 AND setting_type = 'models'`,
        [userId]
      );
      
      if (result.rows.length > 0) {
        const settings = result.rows[0].settings_json;
        return settings.agentOverrides || {};
      }
    } catch (error) {
      logger.warn('Failed to get user model preferences:', error);
    }
    return {};
  }
}

export const agentDelegator = new AgentDelegator();
