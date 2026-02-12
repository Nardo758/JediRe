/**
 * Grok-Powered Trading Strategy
 * Uses xAI to assess TRUE probability vs market price
 * 
 * Core Philosophy:
 * - Grok has better information than the average trader
 * - Market prices often lag behind real-world events
 * - AI can detect patterns humans miss
 * - When Grok's probability differs significantly from market price = OPPORTUNITY
 */

import OpenAI from 'openai';

export interface GrokAnalysis {
  // Grok's assessed probability (0-100)
  trueProbability: number;
  
  // Market's current probability
  marketProbability: number;
  
  // Difference (positive = undervalued, negative = overvalued)
  mispricing: number;
  
  // Grok's confidence in its assessment
  confidence: number; // 0-100
  
  // Why Grok thinks this
  reasoning: string;
  
  // Key factors influencing the outcome
  keyFactors: string[];
  
  // Recent events that matter
  recentEvents?: string[];
  
  // Trading recommendation
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID' | 'SHORT';
  
  // Expected value calculation
  expectedValue: number; // in dollars per $100 bet
}

export class GrokStrategy {
  private client: OpenAI;
  private minMispricing: number; // Minimum % difference to alert
  private minConfidence: number; // Minimum confidence to trade

  constructor(apiKey: string, config?: { minMispricing?: number; minConfidence?: number }) {
    this.client = new OpenAI({
      baseURL: 'https://api.x.ai/v1',
      apiKey: apiKey,
    });
    
    this.minMispricing = config?.minMispricing || 15; // 15% default
    this.minConfidence = config?.minConfidence || 70; // 70% default
  }

  /**
   * Analyze a market using Grok's intelligence
   */
  async analyzeMarket(question: string, yesPrice: number, noPrice: number): Promise<GrokAnalysis | null> {
    try {
      const prompt = this.buildAnalysisPrompt(question, yesPrice, noPrice);
      
      const response = await this.client.chat.completions.create({
        model: 'grok-3',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temp = more consistent
      });

      const analysis = this.parseGrokResponse(response.choices[0].message.content || '');
      
      if (!analysis) return null;

      // Calculate mispricing
      const marketProb = yesPrice;
      const trueProbcalc = analysis.trueProbability;
      const mispricing = trueProbcalc - marketProb;

      // Calculate expected value
      const ev = this.calculateExpectedValue(trueProbcalc, marketProb);

      return {
        trueProbability: trueProbcalc,
        marketProbability: marketProb,
        mispricing: mispricing,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
        keyFactors: analysis.keyFactors,
        recentEvents: analysis.recentEvents,
        recommendation: this.getRecommendation(mispricing, analysis.confidence),
        expectedValue: ev,
      };
    } catch (error) {
      console.error('Grok analysis failed:', error);
      return null;
    }
  }

  /**
   * System prompt - tells Grok how to think
   */
  private getSystemPrompt(): string {
    return `You are a world-class prediction analyst specializing in probability assessment for prediction markets.

Your job is to:
1. Analyze the question objectively using all available information
2. Determine the TRUE probability of the outcome (0-100%)
3. Identify key factors that will determine the outcome
4. Assess your confidence in this probability
5. Note any recent events that matter

Be brutally honest and data-driven. Don't be swayed by what you think the market "should" price - focus on what WILL actually happen.

Consider:
- Historical precedent
- Current events and news
- Expert opinions and polls
- Market sentiment vs reality
- Base rates and statistics
- Time horizon until resolution

Output your analysis in this exact JSON format:
{
  "trueProbability": <0-100>,
  "confidence": <0-100>,
  "reasoning": "<your explanation>",
  "keyFactors": ["factor 1", "factor 2", ...],
  "recentEvents": ["event 1", "event 2", ...]
}`;
  }

  /**
   * Build analysis prompt for specific market
   */
  private buildAnalysisPrompt(question: string, yesPrice: number, noPrice: number): string {
    return `Analyze this prediction market:

QUESTION: ${question}

CURRENT MARKET PRICES:
- YES: ${yesPrice}% (implied probability)
- NO: ${noPrice}% (implied probability)

What is the TRUE probability that this resolves YES?

Consider:
1. Is the market correctly pricing the probability?
2. Are there recent events the market hasn't priced in?
3. What factors will determine the outcome?
4. How confident are you in your assessment?

Provide your analysis in the specified JSON format.`;
  }

  /**
   * Parse Grok's JSON response
   */
  private parseGrokResponse(content: string): any | null {
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in Grok response');
        return null;
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Failed to parse Grok response:', error);
      return null;
    }
  }

  /**
   * Calculate expected value of a bet
   * EV = (True Prob * Payout if Win) - (Cost)
   */
  private calculateExpectedValue(trueProb: number, marketPrice: number): number {
    const betSize = 100; // $100 bet
    const cost = betSize * (marketPrice / 100);
    const payoutIfWin = betSize;
    
    const ev = ((trueProb / 100) * payoutIfWin) - cost;
    return Math.round(ev * 100) / 100; // Round to 2 decimals
  }

  /**
   * Get trading recommendation
   */
  private getRecommendation(
    mispricing: number,
    confidence: number
  ): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID' | 'SHORT' {
    // Market undervalues (Grok thinks it's higher)
    if (mispricing > 0) {
      if (mispricing >= 25 && confidence >= 80) return 'STRONG_BUY';
      if (mispricing >= 15 && confidence >= 70) return 'BUY';
      if (mispricing >= 10 && confidence >= 60) return 'HOLD';
      return 'AVOID';
    }
    
    // Market overvalues (Grok thinks it's lower)
    else {
      if (mispricing <= -25 && confidence >= 80) return 'SHORT'; // Bet NO
      if (mispricing <= -15 && confidence >= 70) return 'SHORT';
      return 'AVOID';
    }
  }

  /**
   * Check if opportunity meets criteria
   */
  isTradeWorthy(analysis: GrokAnalysis): boolean {
    return (
      Math.abs(analysis.mispricing) >= this.minMispricing &&
      analysis.confidence >= this.minConfidence &&
      analysis.expectedValue > 2 // Must have positive EV > $2
    );
  }

  /**
   * Format analysis for human readability
   */
  formatAnalysis(analysis: GrokAnalysis, question: string): string {
    const lines = [
      `📊 GROK ANALYSIS`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `Market: ${question}`,
      ``,
      `💰 PRICING:`,
      `   Market Price: ${analysis.marketProbability}%`,
      `   Grok's Assessment: ${analysis.trueProbability}%`,
      `   Mispricing: ${analysis.mispricing > 0 ? '+' : ''}${analysis.mispricing.toFixed(1)}%`,
      ``,
      `🎯 RECOMMENDATION: ${analysis.recommendation}`,
      `   Confidence: ${analysis.confidence}%`,
      `   Expected Value: $${analysis.expectedValue.toFixed(2)} per $100 bet`,
      ``,
      `🧠 REASONING:`,
      `   ${analysis.reasoning}`,
      ``,
      `📌 KEY FACTORS:`,
    ];

    analysis.keyFactors.forEach((factor) => {
      lines.push(`   • ${factor}`);
    });

    if (analysis.recentEvents && analysis.recentEvents.length > 0) {
      lines.push(``);
      lines.push(`📰 RECENT EVENTS:`);
      analysis.recentEvents.forEach((event) => {
        lines.push(`   • ${event}`);
      });
    }

    return lines.join('\n');
  }
}

export default GrokStrategy;
