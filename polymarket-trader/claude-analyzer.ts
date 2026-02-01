/**
 * Claude Analyzer
 * Uses Claude for risk assessment and trade recommendations
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Config, Market, ArbitrageOpportunity, GrokAnalysis, ClaudeAnalysis } from './types.js';

export class ClaudeAnalyzer {
  private claude: Anthropic;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    // Claude API key is configured in Clawdbot's environment
    // If not available, will need to be provided via ANTHROPIC_API_KEY env var
    this.claude = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || undefined,
    });
  }

  /**
   * Analyze an arbitrage opportunity and provide trading recommendation
   */
  async analyzeOpportunity(
    opportunity: ArbitrageOpportunity,
    grokAnalysis: GrokAnalysis
  ): Promise<ClaudeAnalysis> {
    try {
      const prompt = this.buildAnalysisPrompt(opportunity, grokAnalysis);
      
      const response = await this.claude.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const analysisText = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';

      return this.parseAnalysis(analysisText, opportunity);
    } catch (error) {
      console.error('Error analyzing with Claude:', error);
      
      // Return cautious fallback
      return {
        recommendation: 'AVOID',
        riskScore: 10,
        arbitrageValid: false,
        positionSize: 0,
        reasoning: 'Analysis service unavailable - defaulting to AVOID for safety',
        exitStrategy: 'N/A',
        concerns: ['Analysis service temporarily unavailable'],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Build comprehensive analysis prompt for Claude
   */
  private buildAnalysisPrompt(
    opportunity: ArbitrageOpportunity,
    grokAnalysis: GrokAnalysis
  ): string {
    const market = opportunity.market;
    
    return `You are an expert prediction market analyst and risk assessor. Analyze this arbitrage opportunity and provide a detailed trading recommendation.

## MARKET INFORMATION

**Question:** ${market.question}
**Category:** ${market.category}
**End Date:** ${market.endDate}
**URL:** ${market.url}

**Current Prices:**
- YES: ${market.yesPrice.toFixed(2)}% ($${market.yesPrice.toFixed(2)} per share)
- NO: ${market.noPrice.toFixed(2)}% ($${market.noPrice.toFixed(2)} per share)

**Market Metrics:**
- Volume: $${market.volume.toLocaleString()}
- Liquidity: $${market.liquidity.toLocaleString()}
- Arbitrage Spread: ${opportunity.spreadPercent.toFixed(2)}%

## ARBITRAGE OPPORTUNITY

The sum of YES + NO prices is ${(market.yesPrice + market.noPrice).toFixed(2)}%, which means there's a ${opportunity.spreadPercent.toFixed(2)}% spread. 

**Theory:** If prices sum to <100%, you can buy both sides and guarantee profit at resolution.

**Example:** Buy $50 YES + $50 NO for total $${(market.yesPrice + market.noPrice).toFixed(2)}. At resolution, one side pays $100. Profit: $${opportunity.spreadPercent.toFixed(2)}.

## GROK ANALYSIS (Real-time Twitter/News)

**Sentiment:** ${grokAnalysis.sentiment}
**Confidence:** ${grokAnalysis.confidence}%
**Summary:** ${grokAnalysis.summary}

**Twitter Trends:** ${grokAnalysis.twitterTrends.join(', ') || 'None detected'}
**News Highlights:** ${grokAnalysis.newsHighlights.join('; ') || 'None detected'}
**Risk Factors:** ${grokAnalysis.riskFactors.join('; ') || 'None detected'}

## YOUR TASK

Provide a structured analysis with:

1. **Arbitrage Validity**: Is this a real arbitrage opportunity or pricing error?
2. **Risk Assessment**: Rate risk 1-10 (1=very low, 10=very high)
3. **Position Size**: Recommended amount to invest ($${this.config.trading.defaultPositionSize} default, max $${this.config.trading.maxPositionSize})
4. **Recommendation**: STRONG_BUY | BUY | HOLD | AVOID
5. **Reasoning**: Why this recommendation?
6. **Exit Strategy**: When/how to exit?
7. **Concerns**: What could go wrong?

## RISK FACTORS TO CONSIDER

- **Market Resolution Risk**: Could the market resolve unexpectedly?
- **Liquidity Risk**: Can we exit if needed? (liquidity: $${market.liquidity.toLocaleString()})
- **Time Risk**: How long until resolution? (${market.endDate})
- **Information Risk**: Is one side clearly mispriced based on news?
- **Execution Risk**: Spread might close before we execute
- **Platform Risk**: Polymarket contract risk

## OUTPUT FORMAT

Respond with JSON:

{
  "recommendation": "STRONG_BUY|BUY|HOLD|AVOID",
  "riskScore": 5,
  "arbitrageValid": true,
  "positionSize": 50,
  "reasoning": "2-3 sentence explanation",
  "exitStrategy": "Exit strategy description",
  "concerns": ["Concern 1", "Concern 2"]
}

Be conservative. Real money is at stake. Risk tolerance: ${this.config.trading.riskTolerance}.`;
  }

  /**
   * Parse Claude's analysis response
   */
  private parseAnalysis(analysisText: string, opportunity: ArbitrageOpportunity): ClaudeAnalysis {
    try {
      // Extract JSON from response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          recommendation: this.normalizeRecommendation(parsed.recommendation),
          riskScore: Math.min(10, Math.max(1, parsed.riskScore || 5)),
          arbitrageValid: parsed.arbitrageValid !== false,
          positionSize: Math.min(
            this.config.trading.maxPositionSize,
            Math.max(0, parsed.positionSize || this.config.trading.defaultPositionSize)
          ),
          reasoning: parsed.reasoning || analysisText.slice(0, 300),
          exitStrategy: parsed.exitStrategy || 'Hold until market resolution',
          concerns: parsed.concerns || [],
          timestamp: Date.now(),
        };
      }
    } catch (e) {
      console.error('Error parsing Claude analysis:', e);
    }

    // Fallback: conservative analysis
    return {
      recommendation: 'HOLD',
      riskScore: 7,
      arbitrageValid: opportunity.spreadPercent >= 3,
      positionSize: this.config.trading.defaultPositionSize,
      reasoning: 'Unable to parse full analysis. Defaulting to conservative HOLD.',
      exitStrategy: 'Monitor and reassess',
      concerns: ['Analysis parsing failed'],
      timestamp: Date.now(),
    };
  }

  /**
   * Normalize recommendation string
   */
  private normalizeRecommendation(rec: string): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID' {
    const r = rec.toUpperCase().replace(/[^A-Z_]/g, '');
    if (r.includes('STRONG') && r.includes('BUY')) return 'STRONG_BUY';
    if (r.includes('BUY')) return 'BUY';
    if (r.includes('AVOID')) return 'AVOID';
    return 'HOLD';
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.claude.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error) {
      console.error('Claude API health check failed:', error);
      return false;
    }
  }
}
