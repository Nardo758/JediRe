/**
 * Research → Acquisitions Collaboration
 * 
 * Research finds market signals → Acquisitions adjusts screening criteria
 * 
 * Key Handoffs:
 * - Cap rate movements → Adjust max bid
 * - Supply pipeline → Risk flags by market
 * - Interest rate changes → Debt assumption updates
 * - Rent growth trends → Underwriting adjustments
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../../../database/connection';
import { logger } from '../../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface MarketSignal {
  id: string;
  signalType: 'cap_rate' | 'supply' | 'interest_rate' | 'rent_growth' | 'employment' | 'population';
  market: string; // MSA or submarket
  direction: 'up' | 'down' | 'stable';
  magnitude: number; // % change or basis points
  source: string;
  confidence: number; // 0-100
  detectedAt: Date;
  dataPoints?: any[];
}

export interface ScreeningAdjustment {
  id: string;
  generatedAt: Date;
  triggeringSignals: MarketSignal[];
  
  // Market-level adjustments
  marketAdjustments: {
    market: string;
    riskRating: 'upgrade' | 'downgrade' | 'maintain';
    previousRating: number; // 1-5
    newRating: number;
    rationale: string;
  }[];
  
  // Underwriting parameter adjustments
  underwritingAdjustments: {
    parameter: string;
    market: string;
    previousValue: number;
    newValue: number;
    rationale: string;
  }[];
  
  // Deal screening criteria changes
  screeningCriteria: {
    criteria: string;
    adjustment: string;
    markets: string[];
    rationale: string;
  }[];
  
  // Alerts for active pipeline
  pipelineAlerts: {
    dealId: string;
    dealName: string;
    alert: string;
    suggestedAction: string;
  }[];
  
  summaryForAcquisitions: string;
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// RESEARCH → ACQUISITIONS SERVICE
// ============================================================================

class ResearchAcquisitionsService {
  
  /**
   * Research processes market signal and generates screening adjustments
   */
  async processMarketSignal(signal: MarketSignal, userId: string): Promise<ScreeningAdjustment> {
    logger.info('Research processing market signal for Acquisitions', { signalType: signal.signalType, market: signal.market });
    
    // Get current screening parameters
    const currentParams = await this.getCurrentScreeningParams(userId);
    
    // Get active pipeline in this market
    const activePipeline = await this.getActivePipeline(userId, signal.market);
    
    // Generate AI recommendations
    const aiAnalysis = await this.getAIRecommendations(signal, currentParams, activePipeline);
    
    const adjustment: ScreeningAdjustment = {
      id: `screen_adj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      generatedAt: new Date(),
      triggeringSignals: [signal],
      marketAdjustments: aiAnalysis.marketAdjustments || [],
      underwritingAdjustments: aiAnalysis.underwritingAdjustments || [],
      screeningCriteria: aiAnalysis.screeningCriteria || [],
      pipelineAlerts: aiAnalysis.pipelineAlerts || [],
      summaryForAcquisitions: aiAnalysis.summaryForAcquisitions || 'Market signal processed',
    };
    
    // Store and apply adjustments
    await this.storeAdjustment(adjustment, userId);
    await this.applyAdjustments(adjustment, userId);
    await this.notifyAcquisitions(userId, adjustment);
    
    return adjustment;
  }

  /**
   * Batch process multiple signals (e.g., from scheduled discovery)
   */
  async processBatchSignals(signals: MarketSignal[], userId: string): Promise<ScreeningAdjustment> {
    logger.info('Research processing batch market signals', { count: signals.length });
    
    // Group by market
    const byMarket = signals.reduce((acc, s) => {
      if (!acc[s.market]) acc[s.market] = [];
      acc[s.market].push(s);
      return acc;
    }, {} as Record<string, MarketSignal[]>);
    
    const currentParams = await this.getCurrentScreeningParams(userId);
    const activePipeline = await this.getActivePipelineAll(userId);
    
    const aiAnalysis = await this.getBatchAIRecommendations(byMarket, currentParams, activePipeline);
    
    const adjustment: ScreeningAdjustment = {
      id: `screen_adj_batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      generatedAt: new Date(),
      triggeringSignals: signals,
      marketAdjustments: aiAnalysis.marketAdjustments || [],
      underwritingAdjustments: aiAnalysis.underwritingAdjustments || [],
      screeningCriteria: aiAnalysis.screeningCriteria || [],
      pipelineAlerts: aiAnalysis.pipelineAlerts || [],
      summaryForAcquisitions: aiAnalysis.summaryForAcquisitions || 'Batch signals processed',
    };
    
    await this.storeAdjustment(adjustment, userId);
    await this.applyAdjustments(adjustment, userId);
    await this.notifyAcquisitions(userId, adjustment);
    
    return adjustment;
  }

  /**
   * Get current screening parameters
   */
  private async getCurrentScreeningParams(userId: string): Promise<any> {
    try {
      const result = await query(
        `SELECT * FROM user_screening_params WHERE user_id = $1`,
        [userId]
      );
      if (result.rows.length > 0) {
        return result.rows[0].params;
      }
    } catch (error) {
      logger.warn('Failed to get screening params', { error });
    }
    
    // Default params
    return {
      minIRR: 15,
      maxCapRate: 6.5,
      minUnits: 50,
      maxLTV: 70,
      targetMarkets: ['Phoenix', 'Dallas', 'Atlanta', 'Tampa', 'Charlotte'],
      marketRatings: {
        'Phoenix': 4,
        'Dallas': 4,
        'Atlanta': 3,
        'Tampa': 4,
        'Charlotte': 3,
      },
      rentGrowthAssumptions: {
        'default': 3,
        'Phoenix': 4,
        'Dallas': 3.5,
      },
    };
  }

  /**
   * Get active pipeline deals in a market
   */
  private async getActivePipeline(userId: string, market: string): Promise<any[]> {
    try {
      const result = await query(
        `SELECT d.id, d.name, d.status, p.city, p.state
         FROM deals d
         LEFT JOIN properties p ON d.property_id = p.id
         WHERE d.user_id = $1 
           AND d.status IN ('screening', 'underwriting', 'loi', 'due_diligence')
           AND (p.city ILIKE $2 OR p.state ILIKE $2 OR d.name ILIKE $3)
         LIMIT 20`,
        [userId, `%${market}%`, `%${market}%`]
      );
      return result.rows;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get all active pipeline
   */
  private async getActivePipelineAll(userId: string): Promise<any[]> {
    try {
      const result = await query(
        `SELECT d.id, d.name, d.status, p.city, p.state
         FROM deals d
         LEFT JOIN properties p ON d.property_id = p.id
         WHERE d.user_id = $1 
           AND d.status IN ('screening', 'underwriting', 'loi', 'due_diligence')
         LIMIT 50`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get AI recommendations for single signal
   */
  private async getAIRecommendations(signal: MarketSignal, currentParams: any, activePipeline: any[]): Promise<any> {
    const prompt = `You are a real estate Research analyst advising Acquisitions on screening adjustments.

MARKET SIGNAL:
- Type: ${signal.signalType}
- Market: ${signal.market}
- Direction: ${signal.direction}
- Magnitude: ${signal.magnitude}% ${signal.signalType === 'cap_rate' || signal.signalType === 'interest_rate' ? 'bps' : ''}
- Source: ${signal.source}
- Confidence: ${signal.confidence}%

CURRENT SCREENING PARAMS:
- Min IRR Target: ${currentParams.minIRR}%
- Max Cap Rate: ${currentParams.maxCapRate}%
- Target Markets: ${currentParams.targetMarkets?.join(', ')}
- ${signal.market} Rating: ${currentParams.marketRatings?.[signal.market] || 'Not rated'}/5

ACTIVE PIPELINE IN ${signal.market}:
${activePipeline.length > 0 ? activePipeline.map(d => `- ${d.name} (${d.status})`).join('\n') : 'None'}

Based on this signal, provide recommendations in JSON:
{
  "marketAdjustments": [
    {
      "market": "${signal.market}",
      "riskRating": "upgrade|downgrade|maintain",
      "previousRating": ${currentParams.marketRatings?.[signal.market] || 3},
      "newRating": <1-5>,
      "rationale": "<why>"
    }
  ],
  "underwritingAdjustments": [
    {
      "parameter": "rentGrowth|capRate|exitCap|etc",
      "market": "${signal.market}",
      "previousValue": <current>,
      "newValue": <new>,
      "rationale": "<why>"
    }
  ],
  "screeningCriteria": [
    {
      "criteria": "<what to change>",
      "adjustment": "<how to change>",
      "markets": ["${signal.market}"],
      "rationale": "<why>"
    }
  ],
  "pipelineAlerts": [
    {
      "dealId": "<deal id if applicable>",
      "dealName": "<deal name>",
      "alert": "<what changed>",
      "suggestedAction": "<what to do>"
    }
  ],
  "summaryForAcquisitions": "<1-2 sentence summary>"
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content.find(b => b.type === 'text')?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch?.[0] || '{}');
    } catch (error) {
      logger.warn('AI screening adjustment failed', { error });
      return {};
    }
  }

  /**
   * Get AI recommendations for batch signals
   */
  private async getBatchAIRecommendations(
    byMarket: Record<string, MarketSignal[]>,
    currentParams: any,
    activePipeline: any[]
  ): Promise<any> {
    const marketsummary = Object.entries(byMarket).map(([market, signals]) => {
      return `${market}:\n${signals.map(s => `  - ${s.signalType}: ${s.direction} ${s.magnitude}%`).join('\n')}`;
    }).join('\n\n');

    const prompt = `You are a real estate Research analyst advising Acquisitions on screening adjustments based on multiple market signals.

MARKET SIGNALS BY MARKET:
${marketsummary}

CURRENT SCREENING PARAMS:
- Min IRR Target: ${currentParams.minIRR}%
- Max Cap Rate: ${currentParams.maxCapRate}%
- Target Markets: ${currentParams.targetMarkets?.join(', ')}
- Market Ratings: ${JSON.stringify(currentParams.marketRatings)}

ACTIVE PIPELINE (${activePipeline.length} deals):
${activePipeline.slice(0, 10).map(d => `- ${d.name} in ${d.city || 'Unknown'} (${d.status})`).join('\n')}

Synthesize these signals and provide comprehensive recommendations in JSON:
{
  "marketAdjustments": [...],
  "underwritingAdjustments": [...],
  "screeningCriteria": [...],
  "pipelineAlerts": [...],
  "summaryForAcquisitions": "<executive summary>"
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content.find(b => b.type === 'text')?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch?.[0] || '{}');
    } catch (error) {
      logger.warn('AI batch screening adjustment failed', { error });
      return {};
    }
  }

  /**
   * Store adjustment
   */
  private async storeAdjustment(adj: ScreeningAdjustment, userId: string): Promise<void> {
    try {
      await query(
        `INSERT INTO agent_collaboration_screening_adjustments
         (id, user_id, triggering_signals, market_adjustments, underwriting_adjustments,
          screening_criteria, pipeline_alerts, summary, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          adj.id, userId, JSON.stringify(adj.triggeringSignals),
          JSON.stringify(adj.marketAdjustments), JSON.stringify(adj.underwritingAdjustments),
          JSON.stringify(adj.screeningCriteria), JSON.stringify(adj.pipelineAlerts),
          adj.summaryForAcquisitions, adj.generatedAt,
        ]
      );
    } catch (error) {
      logger.warn('Failed to store screening adjustment', { error });
    }
  }

  /**
   * Apply adjustments to user's screening params
   */
  private async applyAdjustments(adj: ScreeningAdjustment, userId: string): Promise<void> {
    // Apply market rating changes
    for (const ma of adj.marketAdjustments) {
      if (ma.riskRating !== 'maintain') {
        try {
          await query(
            `UPDATE user_screening_params 
             SET params = jsonb_set(params, '{marketRatings,${ma.market}}', $1::jsonb)
             WHERE user_id = $2`,
            [JSON.stringify(ma.newRating), userId]
          );
        } catch (error) {
          logger.warn('Failed to apply market rating', { error });
        }
      }
    }
    
    // Apply underwriting adjustments
    for (const ua of adj.underwritingAdjustments) {
      try {
        await query(
          `UPDATE user_screening_params 
           SET params = jsonb_set(params, '{${ua.parameter}Assumptions,${ua.market}}', $1::jsonb)
           WHERE user_id = $2`,
          [JSON.stringify(ua.newValue), userId]
        );
      } catch (error) {
        logger.warn('Failed to apply underwriting adjustment', { error });
      }
    }
  }

  /**
   * Notify Acquisitions agent
   */
  private async notifyAcquisitions(userId: string, adj: ScreeningAdjustment): Promise<void> {
    // Only notify if there are material changes
    if (adj.marketAdjustments.length === 0 && adj.pipelineAlerts.length === 0) {
      return;
    }

    try {
      await query(
        `INSERT INTO agent_notifications 
         (user_id, deal_id, agent_id, type, title, message, channels)
         VALUES ($1, NULL, 'acquisitions', 'info', $2, $3, '["in_app"]')`,
        [
          userId,
          'Research: Screening Criteria Updated',
          adj.summaryForAcquisitions,
        ]
      );

      // Alert for each pipeline deal affected
      for (const pa of adj.pipelineAlerts) {
        await query(
          `INSERT INTO agent_notifications 
           (user_id, deal_id, agent_id, type, title, message, channels)
           VALUES ($1, $2, 'acquisitions', 'warning', $3, $4, '["in_app", "email"]')`,
          [
            userId, pa.dealId,
            `Pipeline Alert: ${pa.dealName}`,
            `${pa.alert}\n\nSuggested: ${pa.suggestedAction}`,
          ]
        );
      }
    } catch (error) {
      logger.warn('Failed to notify acquisitions', { error });
    }
  }

  /**
   * Get adjustment history
   */
  async getAdjustmentHistory(userId: string, limit: number = 20): Promise<ScreeningAdjustment[]> {
    const result = await query(
      `SELECT * FROM agent_collaboration_screening_adjustments WHERE user_id = $1 ORDER BY generated_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows.map(row => ({
      id: row.id,
      generatedAt: row.generated_at,
      triggeringSignals: row.triggering_signals,
      marketAdjustments: row.market_adjustments,
      underwritingAdjustments: row.underwriting_adjustments,
      screeningCriteria: row.screening_criteria,
      pipelineAlerts: row.pipeline_alerts,
      summaryForAcquisitions: row.summary,
    }));
  }
}

export const researchAcquisitionsService = new ResearchAcquisitionsService();
export default researchAcquisitionsService;
