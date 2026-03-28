/**
 * Response Synthesizer
 * 
 * Combines agent outputs into unified responses.
 * Calculates JEDI scores. Formats for different channels.
 * 
 * @version 1.0.0
 * @date 2026-03-28
 */

import { generateCompletion, isLLMAvailable } from '../llm.service';
import { logger } from '../../utils/logger';
import type { DelegationResult } from './agent-delegator';
import type { ExtractedIntent } from './intent-classifier';

// ============================================================================
// Types
// ============================================================================

export interface SynthesizedResponse {
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
  
  // Follow-up suggestions
  suggestedFollowups: string[];
  
  // Inline keyboard for Telegram
  inlineKeyboard?: {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  };
  
  // Metadata
  executionTimeMs: number;
  timestamp: number;
}

// ============================================================================
// JEDI Score Weights
// ============================================================================

const JEDI_WEIGHTS = {
  zoning: 0.20,
  market: 0.30,
  financial: 0.50,
};

// ============================================================================
// Response Synthesizer
// ============================================================================

export class ResponseSynthesizer {
  
  /**
   * Synthesize agent results into a unified response
   */
  async synthesize(
    intent: ExtractedIntent,
    delegationResults: DelegationResult[],
    options?: {
      platform?: string;
      includeScore?: boolean;
    }
  ): Promise<SynthesizedResponse> {
    const startTime = Date.now();
    
    const successfulResults = delegationResults.filter(r => r.success);
    const failedResults = delegationResults.filter(r => !r.success);
    
    // Handle no successful results
    if (successfulResults.length === 0) {
      return this.createErrorResponse(intent, failedResults, startTime);
    }
    
    // Build agent contributions
    const agentContributions = delegationResults.map(r => ({
      agent: r.agent,
      summary: r.summary || (r.success ? 'Data retrieved' : r.error || 'Failed'),
      success: r.success,
    }));
    
    // Calculate JEDI score if we have enough data
    let jediScore: number | undefined;
    let jediBreakdown: SynthesizedResponse['jediBreakdown'];
    let recommendation: SynthesizedResponse['recommendation'];
    
    if (options?.includeScore !== false && intent.type === 'full_analysis') {
      const scoreResult = this.calculateJediScore(successfulResults);
      jediScore = scoreResult.total;
      jediBreakdown = scoreResult.breakdown;
      recommendation = this.getRecommendation(jediScore);
    }
    
    // Synthesize text response
    let text: string;
    if (isLLMAvailable()) {
      text = await this.llmSynthesize(intent, successfulResults, jediScore, recommendation);
    } else {
      text = this.fallbackSynthesize(successfulResults);
    }
    
    // Generate follow-ups
    const suggestedFollowups = this.generateFollowups(intent, successfulResults);
    
    // Build inline keyboard for Telegram
    const inlineKeyboard = this.buildInlineKeyboard(suggestedFollowups);
    
    // Combine all data
    const combinedData = successfulResults.reduce((acc, r) => {
      acc[r.agent] = r.data;
      return acc;
    }, {} as Record<string, unknown>);
    
    return {
      text,
      summary: text.slice(0, 200) + (text.length > 200 ? '...' : ''),
      jediScore,
      jediBreakdown,
      recommendation,
      data: combinedData,
      agentContributions,
      suggestedFollowups,
      inlineKeyboard,
      executionTimeMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Calculate JEDI score from agent results
   */
  private calculateJediScore(results: DelegationResult[]): {
    total: number;
    breakdown: { zoning: number; market: number; financial: number };
  } {
    let zoningScore = 50;
    let marketScore = 50;
    let financialScore = 50;
    
    for (const result of results) {
      const data = result.data as any;
      
      switch (result.agent) {
        case 'ZONING':
          if (data.maxBuildableUnits > 0) zoningScore += 20;
          if (data.confidence > 0.7) zoningScore += 10;
          if (data.overlays?.length === 0) zoningScore += 10;
          zoningScore = Math.min(100, zoningScore);
          break;
          
        case 'SUPPLY':
          if (data.absorptionRate > 15) marketScore += 15;
          if (data.vacancyRate < 5) marketScore += 10;
          if (data.monthsOfSupply < 6) marketScore += 10;
          if (data.opportunityScore) marketScore = (marketScore + data.opportunityScore) / 2;
          marketScore = Math.min(100, marketScore);
          break;
          
        case 'CASH':
          if (data.cashOnCashReturn > 8) financialScore += 15;
          if (data.cashOnCashReturn > 12) financialScore += 10;
          if (data.monthlyCashFlow > 0) financialScore += 15;
          if (data.opportunityScore) financialScore = (financialScore + data.opportunityScore) / 2;
          financialScore = Math.min(100, financialScore);
          break;
          
        case 'RESEARCH':
          // Research improves confidence in other scores
          if (data.meta?.confidenceScore > 0.7) {
            zoningScore = Math.min(100, zoningScore + 5);
            marketScore = Math.min(100, marketScore + 5);
          }
          break;
      }
    }
    
    const total = Math.round(
      zoningScore * JEDI_WEIGHTS.zoning +
      marketScore * JEDI_WEIGHTS.market +
      financialScore * JEDI_WEIGHTS.financial
    );
    
    return {
      total,
      breakdown: {
        zoning: Math.round(zoningScore),
        market: Math.round(marketScore),
        financial: Math.round(financialScore),
      },
    };
  }
  
  /**
   * Get recommendation based on JEDI score
   */
  private getRecommendation(score: number): SynthesizedResponse['recommendation'] {
    if (score >= 80) return 'BUY';
    if (score >= 65) return 'INVESTIGATE';
    if (score >= 50) return 'HOLD';
    if (score >= 35) return 'PASS';
    return 'PASS';
  }
  
  /**
   * LLM-powered synthesis
   */
  private async llmSynthesize(
    intent: ExtractedIntent,
    results: DelegationResult[],
    jediScore?: number,
    recommendation?: string
  ): Promise<string> {
    const dataContext = results
      .map(r => `[${r.agent}]:\n${JSON.stringify(r.data, null, 2)}`)
      .join('\n\n');
    
    const prompt = `You are JEDI, the AI orchestrator for a real estate investment platform.
Synthesize this analysis into a clear, actionable response.

User Query: "${intent.question}"
${intent.address ? `Property: ${intent.address}` : ''}
${jediScore !== undefined ? `JEDI Score: ${jediScore}/100 (${recommendation})` : ''}

Agent Data:
${dataContext}

Guidelines:
- Lead with the key insight or recommendation
- Be concise but thorough (150-250 words)
- Highlight opportunities and risks
- Use bullet points for multiple metrics
- Format numbers nicely ($1.5M, 8.5%, etc.)
- End with a clear next step or question
${jediScore !== undefined ? `- Reference the JEDI score and what's driving it` : ''}`;

    try {
      const response = await generateCompletion({
        prompt,
        maxTokens: 600,
        temperature: 0.7,
      });
      return response.text;
    } catch (error) {
      logger.error('LLM synthesis failed:', error);
      return this.fallbackSynthesize(results);
    }
  }
  
  /**
   * Fallback text synthesis without LLM
   */
  private fallbackSynthesize(results: DelegationResult[]): string {
    const parts: string[] = [];
    
    for (const r of results) {
      if (r.summary) {
        parts.push(`**${r.agent}:** ${r.summary}`);
      } else {
        parts.push(`**${r.agent}:** ${JSON.stringify(r.data, null, 2)}`);
      }
    }
    
    return parts.join('\n\n');
  }
  
  /**
   * Generate follow-up suggestions
   */
  private generateFollowups(
    intent: ExtractedIntent,
    results: DelegationResult[]
  ): string[] {
    const followups: string[] = [];
    const usedAgents = new Set(results.map(r => r.agent));
    
    // Suggest agents that weren't used
    if (!usedAgents.has('CASH') && intent.address) {
      followups.push('Run cash flow analysis');
    }
    if (!usedAgents.has('COMPS')) {
      followups.push('Find comparable properties');
    }
    if (!usedAgents.has('DEBT')) {
      followups.push('What financing options?');
    }
    
    // Intent-based follow-ups
    if (intent.type === 'full_analysis') {
      followups.push('Generate deal report');
      followups.push('What are the risks?');
    }
    
    if (usedAgents.has('ZONING')) {
      followups.push('Development scenarios?');
    }
    
    if (usedAgents.has('SUPPLY')) {
      followups.push('Demand drivers?');
    }
    
    return followups.slice(0, 4);
  }
  
  /**
   * Build Telegram inline keyboard
   */
  private buildInlineKeyboard(followups: string[]): SynthesizedResponse['inlineKeyboard'] | undefined {
    if (followups.length === 0) return undefined;
    
    // Split into rows of 2
    const rows: Array<Array<{ text: string; callback_data: string }>> = [];
    for (let i = 0; i < followups.length; i += 2) {
      const row = followups.slice(i, i + 2).map(text => ({
        text,
        callback_data: text,
      }));
      rows.push(row);
    }
    
    return { inline_keyboard: rows };
  }
  
  /**
   * Create error response
   */
  private createErrorResponse(
    intent: ExtractedIntent,
    failedResults: DelegationResult[],
    startTime: number
  ): SynthesizedResponse {
    const errors = failedResults.map(r => `${r.agent}: ${r.error}`).join(', ');
    
    return {
      text: `I couldn't complete your request. ${errors || 'Please try again.'}`,
      agentContributions: failedResults.map(r => ({
        agent: r.agent,
        summary: r.error || 'Failed',
        success: false,
      })),
      suggestedFollowups: ['Try again', 'Ask a different question'],
      executionTimeMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }
}

export const responseSynthesizer = new ResponseSynthesizer();
