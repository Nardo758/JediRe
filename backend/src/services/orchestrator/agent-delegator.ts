/**
 * Agent Delegator
 *
 * Routes requests to specialist and analyst agents via the INTENT_DISPATCH
 * table (Phase 4 coordinator layer).
 *
 * Layer 1 specialists (RESEARCH, ZONING, SUPPLY, CASH) route to AgentRuntime.
 * Layer 2 specialists (DEMAND, COMPS, RISK, DEBT, NEWS, STRATEGY) route to
 * context fragment injection — no separate agent run, just prompt enrichment.
 *
 * Analyst agents (16 personas) use the persona voice prefix from coordinator/personas.
 *
 * @version 2.0.0
 * @date 2026-04-19
 */

import { logger } from '../../utils/logger';
import { query } from '../../database/connection';
import { generateCompletion, isLLMAvailable } from '../llm.service';
import type { SpecialistAgent, AnalystAgent, ExtractedIntent } from './intent-classifier';
import { getDealFinancialContext, formatFinancialContextForPrompt, DealFinancialContext } from '../deal-financial-context.service';
import { MetricRecommendationService } from '../metricRecommendation.service';

// ── Coordinator layer ─────────────────────────────────────────────
import {
  INTENT_DISPATCH,
  SPECIALIST_PERSONA_MAP,
  isAgentDispatch,
  isFragmentDispatch,
  type SpecialistKey,
} from '../../coordinator/dispatch';
import { buildFragmentPrompt, type FragmentDealContext } from '../../coordinator/context-fragments';
import {
  buildPersonaPrompt,
  getPersona,
  type PersonaId,
} from '../../coordinator/personas/index';

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
  /**
   * For analyst results: the PersonaId that was used to generate the response.
   * Used by ResponseSynthesizer to build the persona header.
   */
  personaId?: string;
  /**
   * For specialist results mapped via SPECIALIST_PERSONA_MAP: the domain label
   * used in the persona header (e.g. "Zoning & Entitlements").
   */
  domainLabel?: string;
}

export interface DelegationRequest {
  intent: ExtractedIntent;
  userId: string;
  userTier?: string;
  modelOverrides?: Record<string, string>;
}

// ============================================================================
// Agent Delegator
// ============================================================================

export class AgentDelegator {
  private static METRIC_REC_TRIGGERS = [
    'what metrics', 'which metrics', 'metrics to watch', 'recommended metrics',
    'metric recommendations', 'what should i watch', 'what should i track',
    'leading indicators', 'suggest metrics', 'suggested metrics',
  ];

  private isMetricRecommendationQuery(message: string): boolean {
    const lower = message.toLowerCase();
    return AgentDelegator.METRIC_REC_TRIGGERS.some(t => lower.includes(t));
  }

  /**
   * Delegate to all required agents based on extracted intent.
   * Specialist agents run in parallel; analysts receive specialist output as context.
   */
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
        this.executeSpecialist(agent, params, userId, intent.dealId)
      );
      const specialistResults = await Promise.all(specialistPromises);
      results.push(...specialistResults);
    }

    if (intent.analysts.length > 0) {
      const specialistData = results
        .filter(r => r.success && r.agentType === 'specialist')
        .reduce((acc, r) => ({ ...acc, [r.agent]: r.data }), {} as Record<string, unknown>);

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
   * Execute a specialist agent.
   *
   * Layer 1 (RESEARCH, ZONING, SUPPLY, CASH): calls AgentRuntime.run() via dispatch table.
   * Layer 2 (DEMAND, COMPS, RISK, DEBT, NEWS, STRATEGY): returns context fragment for
   *   injection into analyst prompts.
   */
  private async executeSpecialist(
    agent: SpecialistAgent,
    params: Record<string, unknown>,
    userId: string,
    dealId?: string
  ): Promise<DelegationResult> {
    const startTime = Date.now();

    const dispatch = INTENT_DISPATCH[agent as SpecialistKey];
    if (!dispatch) {
      return {
        agent,
        agentType: 'specialist',
        data: { message: `${agent} agent not found in dispatch table` },
        executionTimeMs: Date.now() - startTime,
        success: false,
        error: 'No dispatch entry',
      };
    }

    // ── Layer 2: Context fragment injection ───────────────────────
    if (isFragmentDispatch(dispatch)) {
      // Build deal context from delegation params so the fragment prompt
      // is grounded in the active property's data points.
      const dealCtx: FragmentDealContext = {
        address: params.address as string | undefined,
        city: params.city as string | undefined,
        stateCode: params.stateCode as string | undefined,
        propertyType: params.propertyType as string | undefined,
        marketStats: (params.vacancyRate !== undefined ||
                      params.avgRent !== undefined ||
                      params.rentGrowthYoY !== undefined ||
                      params.absorptionRate !== undefined)
          ? {
              vacancyRate: params.vacancyRate as number | undefined,
              avgRent: params.avgRent as number | undefined,
              rentGrowthYoY: params.rentGrowthYoY as number | undefined,
              absorptionRate: params.absorptionRate as number | undefined,
            }
          : undefined,
      };

      const fragmentPrompt = buildFragmentPrompt(dispatch.fragmentKey, dealCtx);
      const personaMapEntry = SPECIALIST_PERSONA_MAP[agent as SpecialistKey];
      return {
        agent,
        agentType: 'specialist',
        data: {
          fragmentKey: dispatch.fragmentKey,
          fragmentPrompt,
          description: dispatch.description,
        },
        executionTimeMs: Date.now() - startTime,
        success: true,
        personaId: personaMapEntry?.personaId,
        domainLabel: personaMapEntry?.domainLabel,
      };
    }

    // ── Layer 1: AgentRuntime execution ───────────────────────────
    if (isAgentDispatch(dispatch)) {
      try {
        logger.info(`[AgentDelegator] Executing specialist via runtime: ${agent}`, {
          agentId: dispatch.agentId,
          dealId,
        });

        const runCtx = {
          dealId,
          userId,
          triggeredBy: 'user' as const,
          triggerContext: { source: 'agent_delegator', specialist: agent },
        };

        const input = this.buildRuntimeInput(agent, params);
        const result = await dispatch.runtime.run(input, runCtx);

        return {
          agent,
          agentType: 'specialist',
          data: result as Record<string, unknown>,
          executionTimeMs: Date.now() - startTime,
          success: true,
        };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[AgentDelegator] Specialist ${agent} runtime failed:`, error);
        return {
          agent,
          agentType: 'specialist',
          data: {},
          executionTimeMs: Date.now() - startTime,
          success: false,
          error: msg,
        };
      }
    }

    return {
      agent,
      agentType: 'specialist',
      data: { message: 'Unknown dispatch type' },
      executionTimeMs: Date.now() - startTime,
      success: false,
      error: 'Unknown dispatch type',
    };
  }

  /**
   * Build runtime input payload for a Layer 1 specialist.
   */
  private buildRuntimeInput(
    agent: SpecialistAgent,
    params: Record<string, unknown>
  ): Record<string, unknown> {
    switch (agent) {
      case 'RESEARCH':
        return {
          deal_id: params.dealId,
          address: params.address,
          property_id: params.propertyId,
        };
      case 'ZONING':
        return {
          deal_id: params.dealId,
          address: params.address,
        };
      case 'SUPPLY':
        return {
          city: params.city,
          state_code: params.stateCode,
          property_type: params.propertyType,
        };
      case 'CASH':
        return {
          deal_id: params.dealId,
          purchase_price_hint: params.price,
        };
      default:
        return { ...params };
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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('MetricRecommendation delegation failed:', error);
      return {
        agent: 'METRIC_RECOMMENDATIONS',
        agentType: 'specialist',
        data: {},
        executionTimeMs: Date.now() - startTime,
        success: false,
        error: msg,
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

    const persona = getPersona(agent);
    if (!persona) {
      return {
        agent,
        agentType: 'analyst',
        data: {},
        executionTimeMs: Date.now() - startTime,
        success: false,
        error: 'Unknown analyst persona',
      };
    }

    try {
      const prompt = this.buildAnalystPrompt(agent as PersonaId, params, contextData);

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
        personaId: agent,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Analyst ${agent} failed:`, error);
      return {
        agent,
        agentType: 'analyst',
        data: {},
        executionTimeMs: Date.now() - startTime,
        success: false,
        error: msg,
      };
    }
  }

  /**
   * Build params from extracted intent
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
   * Build prompt for analyst agent using persona voice prefix +
   * any context fragments from Layer 2 specialist results.
   */
  private buildAnalystPrompt(
    agent: PersonaId,
    params: Record<string, unknown>,
    contextData: Record<string, unknown>
  ): string {
    const personaBlock = buildPersonaPrompt(agent);
    let prompt = personaBlock ? `${personaBlock}\n\n` : '';

    if (params.address) prompt += `Property: ${params.address}\n`;
    if (params.city && params.stateCode) prompt += `Market: ${params.city}, ${params.stateCode}\n`;
    if (params.price) prompt += `Price: $${Number(params.price).toLocaleString()}\n`;

    if (contextData['FINANCIAL_DATA']) {
      const finCtx = contextData['FINANCIAL_DATA'] as DealFinancialContext;
      prompt += formatFinancialContextForPrompt(finCtx);
      prompt += '\n';
    }

    // Inject Layer 2 context fragments (DEMAND, COMPS, RISK, DEBT, NEWS, STRATEGY)
    const fragmentEntries = Object.entries(contextData).filter(
      ([, v]) => v && typeof v === 'object' && 'fragmentPrompt' in (v as object)
    );
    for (const [, fragData] of fragmentEntries) {
      const frag = fragData as { fragmentPrompt: string };
      prompt += frag.fragmentPrompt + '\n\n';
    }

    // Inject Layer 1 specialist results
    const specialistEntries = Object.entries(contextData).filter(
      ([k, v]) => k !== 'FINANCIAL_DATA' &&
        !(v && typeof v === 'object' && 'fragmentPrompt' in (v as object))
    );
    if (specialistEntries.length > 0) {
      prompt += `\nAvailable Data:\n`;
      for (const [source, data] of specialistEntries) {
        prompt += `\n[${source}]:\n${JSON.stringify(data, null, 2)}\n`;
      }
    }

    prompt += `\nUser Question: ${params.question || 'Provide your analysis'}

Respond as the ${getPersona(agent)?.role ?? agent}. Be specific, actionable, and concise (under 200 words).
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
